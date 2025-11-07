/**
 * Optimization Suggester
 * Phase 5 - Week 4: Performance Analysis & Optimization
 *
 * Provides AI-powered optimization recommendations based on performance analysis
 * and code patterns. Analyzes bottlenecks and suggests specific improvements.
 */

import * as fs from 'fs/promises';
import { PerformanceReport, Bottleneck } from './PerformanceAnalyzer';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OptimizationSuggestion {
  id: string;
  category: 'cpu' | 'memory' | 'network' | 'architecture' | 'algorithm';

  title: string;
  description: string;

  impact: {
    level: 'low' | 'medium' | 'high' | 'critical';
    estimatedImprovement: string;    // e.g., "20-30% CPU reduction"
    affectedMetric: 'cpu' | 'memory' | 'network' | 'latency';
  };

  difficulty: {
    level: 'easy' | 'medium' | 'hard';
    estimatedHours: number;
    skillsRequired: string[];
  };

  recommendation: {
    currentPattern: string;           // What's happening now
    suggestedPattern: string;         // What should happen
    codeExample?: string;             // Example implementation
    filesAffected?: string[];         // Files that need changes
  };

  rationale: string;                  // Why this optimization helps
  tradeoffs?: string[];               // Potential downsides
  priority: number;                   // 1-10 (10 = highest)
}

export interface QuickWin {
  suggestion: string;
  estimatedTimeMinutes: number;
  expectedImprovement: string;
}

export interface SuggestionFilters {
  minImpact?: 'low' | 'medium' | 'high';
  maxDifficulty?: 'easy' | 'medium' | 'hard';
  categories?: Array<'cpu' | 'memory' | 'network' | 'architecture' | 'algorithm'>;
}

export interface OptimizationResult {
  summary: {
    totalSuggestions: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    analysisTime: number;
  };

  suggestions: OptimizationSuggestion[];
  quickWins: QuickWin[];
}

// ============================================================================
// OptimizationSuggester Class
// ============================================================================

export class OptimizationSuggester {
  private optimizationPatterns: Map<string, OptimizationSuggestion>;

  constructor() {
    this.optimizationPatterns = new Map();
    this.initializePatterns();
  }

  /**
   * Initialize optimization pattern database
   */
  private initializePatterns(): void {
    // CPU Optimizations
    this.addPattern({
      id: 'cpu-thread-pool-sizing',
      category: 'cpu',
      title: 'Optimize Thread Pool Size',
      description: 'Current thread pool size may not match CPU core count, causing thread contention or underutilization',
      impact: {
        level: 'high',
        estimatedImprovement: '15-25% CPU reduction',
        affectedMetric: 'cpu'
      },
      difficulty: {
        level: 'easy',
        estimatedHours: 2,
        skillsRequired: ['C++', 'Threading']
      },
      recommendation: {
        currentPattern: 'Fixed thread pool size (e.g., 4 threads)',
        suggestedPattern: 'Dynamic thread pool sized to std::thread::hardware_concurrency()',
        codeExample: `// Current
ThreadPool pool(4);

// Suggested
ThreadPool pool(std::thread::hardware_concurrency());`,
        filesAffected: ['src/modules/Playerbot/Threading/ThreadPool.cpp']
      },
      rationale: 'Matching thread pool size to available CPU cores maximizes parallelism while minimizing context switching overhead',
      tradeoffs: ['May use more memory per thread', 'Harder to debug with many threads'],
      priority: 8
    });

    this.addPattern({
      id: 'cpu-lock-free-queues',
      category: 'cpu',
      title: 'Replace Mutexes with Lock-Free Queues',
      description: 'Mutex contention detected in packet processing. Lock-free queues can eliminate this bottleneck',
      impact: {
        level: 'high',
        estimatedImprovement: '30-40% CPU reduction in packet processing',
        affectedMetric: 'cpu'
      },
      difficulty: {
        level: 'hard',
        estimatedHours: 16,
        skillsRequired: ['C++', 'Concurrency', 'Lock-free programming', 'Memory ordering']
      },
      recommendation: {
        currentPattern: 'std::mutex with std::queue for packet processing',
        suggestedPattern: 'boost::lockfree::spsc_queue or boost::lockfree::queue',
        codeExample: `// Current
std::mutex queueMutex;
std::queue<Packet*> packetQueue;

void ProcessPacket(Packet* packet) {
    std::lock_guard<std::mutex> lock(queueMutex);
    packetQueue.push(packet);
}

// Suggested
boost::lockfree::spsc_queue<Packet*> packetQueue(1024);

void ProcessPacket(Packet* packet) {
    packetQueue.push(packet);  // No lock needed
}`,
        filesAffected: ['src/modules/Playerbot/Packets/PacketQueue.cpp']
      },
      rationale: 'Lock-free data structures eliminate mutex contention, reducing CPU overhead and improving scalability',
      tradeoffs: ['More complex to implement', 'Limited queue capacity', 'Memory ordering subtleties'],
      priority: 9
    });

    // Memory Optimizations
    this.addPattern({
      id: 'memory-object-pooling',
      category: 'memory',
      title: 'Implement Object Pooling for Frequently Allocated Objects',
      description: 'High allocation frequency detected. Object pooling can reduce allocator overhead and fragmentation',
      impact: {
        level: 'medium',
        estimatedImprovement: '10-20% memory reduction, 5-10% CPU reduction',
        affectedMetric: 'memory'
      },
      difficulty: {
        level: 'medium',
        estimatedHours: 8,
        skillsRequired: ['C++', 'Memory management', 'Design patterns']
      },
      recommendation: {
        currentPattern: 'new/delete for each packet or bot instance',
        suggestedPattern: 'Pre-allocated object pool with recycling',
        codeExample: `// Current
Packet* packet = new Packet();
// ... use packet ...
delete packet;

// Suggested
class PacketPool {
    std::vector<Packet*> pool;
public:
    Packet* Acquire() {
        if (pool.empty())
            return new Packet();
        Packet* p = pool.back();
        pool.pop_back();
        return p;
    }

    void Release(Packet* p) {
        p->Reset();
        pool.push_back(p);
    }
};`,
        filesAffected: ['src/modules/Playerbot/Packets/PacketPool.h']
      },
      rationale: 'Object pooling reduces allocator overhead, improves cache locality, and prevents memory fragmentation',
      tradeoffs: ['Increased memory usage (pool overhead)', 'Must handle object reset carefully'],
      priority: 7
    });

    this.addPattern({
      id: 'memory-leak-detection',
      category: 'memory',
      title: 'Fix Memory Leak',
      description: 'Memory usage trending upward. Likely memory leak detected',
      impact: {
        level: 'critical',
        estimatedImprovement: 'Prevents OOM crashes',
        affectedMetric: 'memory'
      },
      difficulty: {
        level: 'medium',
        estimatedHours: 4,
        skillsRequired: ['C++', 'Debugging', 'Memory profiling']
      },
      recommendation: {
        currentPattern: 'Leaked allocations not properly freed',
        suggestedPattern: 'Use smart pointers or ensure proper cleanup',
        codeExample: `// Current
void CreateBot() {
    BotData* data = new BotData();  // Never freed
}

// Suggested
void CreateBot() {
    std::unique_ptr<BotData> data = std::make_unique<BotData>();
    // Automatically freed
}`,
        filesAffected: ['Unknown - run memory profiler to identify']
      },
      rationale: 'Memory leaks cause gradual memory exhaustion and eventual server crashes',
      tradeoffs: [],
      priority: 10
    });

    // Network Optimizations
    this.addPattern({
      id: 'network-packet-batching',
      category: 'network',
      title: 'Implement Packet Batching',
      description: 'High packet frequency detected. Batching multiple updates into single packets reduces overhead',
      impact: {
        level: 'high',
        estimatedImprovement: '40-60% network bandwidth reduction',
        affectedMetric: 'network'
      },
      difficulty: {
        level: 'medium',
        estimatedHours: 12,
        skillsRequired: ['C++', 'Networking', 'Protocol design']
      },
      recommendation: {
        currentPattern: 'One packet per spell cast, movement, etc.',
        suggestedPattern: 'Batch multiple actions into single packet per frame',
        codeExample: `// Current
SendPacket(SMSG_SPELL_CAST, spellId);
SendPacket(SMSG_MOVE_UPDATE, position);

// Suggested
class PacketBatcher {
    std::vector<Action> actions;

    void AddAction(Action action) {
        actions.push_back(action);
    }

    void Flush() {
        if (!actions.empty()) {
            SendPacket(SMSG_BATCH_UPDATE, actions);
            actions.clear();
        }
    }
};`,
        filesAffected: ['src/modules/Playerbot/Packets/PacketBatcher.h']
      },
      rationale: 'Packet batching reduces per-packet overhead (headers, system calls) and improves network efficiency',
      tradeoffs: ['Slight increase in latency (batching delay)', 'More complex packet handling'],
      priority: 8
    });

    // Algorithm Optimizations
    this.addPattern({
      id: 'algorithm-spatial-indexing',
      category: 'algorithm',
      title: 'Use Spatial Indexing for Nearby Object Queries',
      description: 'O(n) nearby object searches detected. Use TrinityCore BIH tree for O(log n) performance',
      impact: {
        level: 'high',
        estimatedImprovement: '50-80% CPU reduction in target selection',
        affectedMetric: 'cpu'
      },
      difficulty: {
        level: 'medium',
        estimatedHours: 6,
        skillsRequired: ['C++', 'Data structures', 'TrinityCore API']
      },
      recommendation: {
        currentPattern: 'Linear search through all units for nearby targets',
        suggestedPattern: 'Use Trinity::AnyUnfriendlyUnitInObjectRangeCheck with Cell::VisitAllObjects',
        codeExample: `// Current
for (Unit* unit : allUnits) {
    if (bot->GetDistance(unit) < range)
        targets.push_back(unit);
}

// Suggested
std::list<Unit*> targets;
Trinity::AnyUnfriendlyUnitInObjectRangeCheck check(bot, range);
Trinity::UnitListSearcher<Trinity::AnyUnfriendlyUnitInObjectRangeCheck> searcher(bot, targets, check);
Cell::VisitAllObjects(bot, searcher, range);`,
        filesAffected: ['src/modules/Playerbot/AI/TargetSelection.cpp']
      },
      rationale: 'Spatial indexing (BIH tree) provides logarithmic complexity for range queries vs linear scan',
      tradeoffs: ['Slightly more complex code', 'Requires understanding of TrinityCore grid system'],
      priority: 9
    });

    this.addPattern({
      id: 'algorithm-caching',
      category: 'algorithm',
      title: 'Cache Expensive Calculations',
      description: 'Repeated expensive calculations detected. Cache results to avoid redundant work',
      impact: {
        level: 'medium',
        estimatedImprovement: '10-25% CPU reduction',
        affectedMetric: 'cpu'
      },
      difficulty: {
        level: 'easy',
        estimatedHours: 3,
        skillsRequired: ['C++', 'Caching strategies']
      },
      recommendation: {
        currentPattern: 'Recalculate threat, distance, or spell availability every frame',
        suggestedPattern: 'Cache results with TTL (time-to-live)',
        codeExample: `// Current
float GetThreat(Unit* target) {
    return CalculateComplexThreat(target);  // Called every frame
}

// Suggested
class ThreatCache {
    struct Entry {
        float threat;
        uint32 timestamp;
    };
    std::unordered_map<ObjectGuid, Entry> cache;

    float GetThreat(Unit* target, uint32 ttlMs = 500) {
        auto it = cache.find(target->GetGUID());
        uint32 now = WorldGameTime::GetGameTimeMS();

        if (it != cache.end() && (now - it->second.timestamp) < ttlMs)
            return it->second.threat;

        float threat = CalculateComplexThreat(target);
        cache[target->GetGUID()] = {threat, now};
        return threat;
    }
};`,
        filesAffected: ['src/modules/Playerbot/AI/ThreatManager.cpp']
      },
      rationale: 'Caching avoids redundant calculations, trading memory for CPU performance',
      tradeoffs: ['Stale data (bounded by TTL)', 'Memory overhead for cache'],
      priority: 7
    });

    // Architecture Optimizations
    this.addPattern({
      id: 'architecture-event-driven',
      category: 'architecture',
      title: 'Migrate to Event-Driven Architecture',
      description: 'Polling-based architecture detected. Event-driven approach reduces CPU waste',
      impact: {
        level: 'medium',
        estimatedImprovement: '15-30% CPU reduction',
        affectedMetric: 'cpu'
      },
      difficulty: {
        level: 'hard',
        estimatedHours: 24,
        skillsRequired: ['C++', 'Design patterns', 'Architecture']
      },
      recommendation: {
        currentPattern: 'Polling every frame for state changes',
        suggestedPattern: 'Subscribe to events (OnHealthChanged, OnTargetChanged, etc.)',
        codeExample: `// Current
void Update() {
    if (GetHealth() != lastHealth) {
        // React to health change
        lastHealth = GetHealth();
    }
}

// Suggested
void OnHealthChanged(uint32 oldHealth, uint32 newHealth) {
    // React to health change
}

// Register event handler
bot->RegisterEventHandler(EVENT_HEALTH_CHANGED, OnHealthChanged);`,
        filesAffected: ['src/modules/Playerbot/AI/BotAI.cpp', 'src/modules/Playerbot/Events/']
      },
      rationale: 'Event-driven architecture eliminates wasteful polling, only executing code when state actually changes',
      tradeoffs: ['More complex event registration', 'Potential for event storms'],
      priority: 6
    });
  }

  /**
   * Add optimization pattern to database
   */
  private addPattern(pattern: OptimizationSuggestion): void {
    this.optimizationPatterns.set(pattern.id, pattern);
  }

  /**
   * Analyze performance data and generate suggestions
   */
  async analyzePerfData(
    perfReport: PerformanceReport,
    filters?: SuggestionFilters
  ): Promise<OptimizationResult> {
    const start = performance.now();

    const suggestions: OptimizationSuggestion[] = [];

    // Analyze bottlenecks and match to patterns
    for (const bottleneck of perfReport.bottlenecks) {
      const matchedPatterns = this.matchBottleneckToPatterns(bottleneck);
      suggestions.push(...matchedPatterns);
    }

    // Analyze trends
    if (perfReport.trends.memoryLeakDetected) {
      const leakPattern = this.optimizationPatterns.get('memory-leak-detection');
      if (leakPattern) {
        const customized = { ...leakPattern };
        if (perfReport.trends.memoryLeakRateMBPerMinute) {
          customized.description = `Memory leak detected: ${perfReport.trends.memoryLeakRateMBPerMinute.toFixed(2)} MB/minute leak rate`;
        }
        suggestions.push(customized);
      }
    }

    // Apply filters
    let filteredSuggestions = this.applyFilters(suggestions, filters);

    // Remove duplicates
    filteredSuggestions = this.removeDuplicates(filteredSuggestions);

    // Sort by priority
    filteredSuggestions.sort((a, b) => b.priority - a.priority);

    // Generate quick wins (high impact + easy difficulty)
    const quickWins = this.generateQuickWins(filteredSuggestions);

    // Calculate summary
    const summary = {
      totalSuggestions: filteredSuggestions.length,
      highImpact: filteredSuggestions.filter(s => s.impact.level === 'high' || s.impact.level === 'critical').length,
      mediumImpact: filteredSuggestions.filter(s => s.impact.level === 'medium').length,
      lowImpact: filteredSuggestions.filter(s => s.impact.level === 'low').length,
      analysisTime: performance.now() - start
    };

    return {
      summary,
      suggestions: filteredSuggestions,
      quickWins
    };
  }

  /**
   * Match bottleneck to optimization patterns
   */
  private matchBottleneckToPatterns(bottleneck: Bottleneck): OptimizationSuggestion[] {
    const matches: OptimizationSuggestion[] = [];

    switch (bottleneck.type) {
      case 'cpu':
        if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
          const lockFree = this.optimizationPatterns.get('cpu-lock-free-queues');
          const threadPool = this.optimizationPatterns.get('cpu-thread-pool-sizing');
          const spatial = this.optimizationPatterns.get('algorithm-spatial-indexing');
          const caching = this.optimizationPatterns.get('algorithm-caching');

          if (lockFree) matches.push(lockFree);
          if (threadPool) matches.push(threadPool);
          if (spatial) matches.push(spatial);
          if (caching) matches.push(caching);
        }
        break;

      case 'memory':
        if (bottleneck.metric.includes('Variance') || bottleneck.metric.includes('leak')) {
          const leak = this.optimizationPatterns.get('memory-leak-detection');
          if (leak) matches.push(leak);
        }

        const pooling = this.optimizationPatterns.get('memory-object-pooling');
        if (pooling) matches.push(pooling);
        break;

      case 'network':
        const batching = this.optimizationPatterns.get('network-packet-batching');
        if (batching) matches.push(batching);
        break;
    }

    return matches;
  }

  /**
   * Apply filters to suggestions
   */
  private applyFilters(
    suggestions: OptimizationSuggestion[],
    filters?: SuggestionFilters
  ): OptimizationSuggestion[] {
    if (!filters) return suggestions;

    let filtered = suggestions;

    // Min impact filter
    if (filters.minImpact) {
      const impactLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      const minLevel = impactLevels[filters.minImpact];

      filtered = filtered.filter(s => impactLevels[s.impact.level] >= minLevel);
    }

    // Max difficulty filter
    if (filters.maxDifficulty) {
      const difficultyLevels = { easy: 1, medium: 2, hard: 3 };
      const maxLevel = difficultyLevels[filters.maxDifficulty];

      filtered = filtered.filter(s => difficultyLevels[s.difficulty.level] <= maxLevel);
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(s => filters.categories!.includes(s.category));
    }

    return filtered;
  }

  /**
   * Remove duplicate suggestions
   */
  private removeDuplicates(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const seen = new Set<string>();
    const unique: OptimizationSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.id)) {
        seen.add(suggestion.id);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Generate quick win suggestions
   */
  private generateQuickWins(suggestions: OptimizationSuggestion[]): QuickWin[] {
    return suggestions
      .filter(s =>
        (s.impact.level === 'high' || s.impact.level === 'critical') &&
        s.difficulty.level === 'easy'
      )
      .map(s => ({
        suggestion: s.title,
        estimatedTimeMinutes: s.difficulty.estimatedHours * 60,
        expectedImprovement: s.impact.estimatedImprovement
      }))
      .slice(0, 5);  // Top 5 quick wins
  }

  /**
   * Get all available optimization patterns
   */
  getAllPatterns(): OptimizationSuggestion[] {
    return Array.from(this.optimizationPatterns.values());
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): OptimizationSuggestion | undefined {
    return this.optimizationPatterns.get(id);
  }
}
