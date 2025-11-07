/**
 * Scaling Simulator
 * Phase 5 - Week 4: Performance Analysis & Optimization
 *
 * Simulates bot scaling from 100 to 5000 bots to predict performance characteristics
 * without actual deployment. Uses baseline metrics to predict resource usage with
 * non-linear scaling factors.
 */

import { Statistics } from './PerformanceAnalyzer';

// ============================================================================
// Type Definitions
// ============================================================================

export interface BotProfile {
  roleDistribution: {
    tank: number;                     // Percentage (0-100)
    healer: number;                   // Percentage (0-100)
    dps: number;                      // Percentage (0-100)
  };

  classDistribution?: {
    [className: string]: number;      // Percentage per class
  };

  activityLevel: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat';
}

export interface BaselineMetrics {
  cpuPerBot: number;                  // CPU % per bot
  memoryPerBotMB: number;             // Memory MB per bot
  networkPerBotKBps: number;          // Network KB/s per bot
}

export interface ScalingFactors {
  cpuScalingExponent?: number;        // Non-linear CPU scaling (default: 1.2)
  memoryScalingExponent?: number;     // Non-linear memory scaling (default: 1.05)
  networkScalingExponent?: number;    // Linear network scaling (default: 1.0)
}

export interface ResourceLimits {
  maxCpuPercent?: number;             // Max total CPU % (default: 80)
  maxMemoryGB?: number;               // Max total memory GB (default: 16)
  maxNetworkMbps?: number;            // Max network bandwidth Mbps (default: 1000)
}

export interface SimulationConfig {
  scaling: {
    minBots: number;                  // Starting bot count
    maxBots: number;                  // Maximum bot count
    stepSize: number;                 // Increment per step
  };

  profile: BotProfile;
  baseline: BaselineMetrics;

  scalingFactors?: ScalingFactors;
  limits?: ResourceLimits;
}

export interface ResourcePrediction {
  cpu: {
    totalPercent: number;
    perBotPercent: number;
    coresNeeded: number;
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
}

export interface Feasibility {
  cpuFeasible: boolean;
  memoryFeasible: boolean;
  networkFeasible: boolean;
  overallFeasible: boolean;
}

export interface SimulationStep {
  botCount: number;
  predicted: ResourcePrediction;
  feasibility: Feasibility;
  limitReached?: {
    resource: 'cpu' | 'memory' | 'network';
    utilizationPercent: number;
  };
}

export interface SimulationResult {
  simulation: {
    rangeSimulated: { min: number; max: number; };
    steps: number;
    totalSimulationTime: number;
  };

  results: SimulationStep[];

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

// ============================================================================
// ScalingSimulator Class
// ============================================================================

export class ScalingSimulator {
  private activityMultipliers = {
    idle: { cpu: 0.1, memory: 1.0, network: 0.01 },
    light: { cpu: 0.3, memory: 1.0, network: 0.2 },
    moderate: { cpu: 0.6, memory: 1.0, network: 0.5 },
    heavy: { cpu: 1.0, memory: 1.0, network: 1.0 },
    combat: { cpu: 1.5, memory: 1.1, network: 1.5 }
  };

  constructor() {}

  /**
   * Simulate scaling from minBots to maxBots
   */
  async simulate(config: SimulationConfig): Promise<SimulationResult> {
    const start = performance.now();

    const {
      scaling,
      profile,
      baseline,
      scalingFactors = {},
      limits = {}
    } = config;

    // Apply defaults
    const cpuScalingExp = scalingFactors.cpuScalingExponent ?? 1.2;
    const memoryScalingExp = scalingFactors.memoryScalingExponent ?? 1.05;
    const networkScalingExp = scalingFactors.networkScalingExponent ?? 1.0;

    const maxCpuPercent = limits.maxCpuPercent ?? 80;
    const maxMemoryGB = limits.maxMemoryGB ?? 16;
    const maxNetworkMbps = limits.maxNetworkMbps ?? 1000;

    // Apply activity level multipliers to baseline
    const activityMult = this.activityMultipliers[profile.activityLevel];
    const adjustedBaseline: BaselineMetrics = {
      cpuPerBot: baseline.cpuPerBot * activityMult.cpu,
      memoryPerBotMB: baseline.memoryPerBotMB * activityMult.memory,
      networkPerBotKBps: baseline.networkPerBotKBps * activityMult.network
    };

    // Simulate each step
    const results: SimulationStep[] = [];
    let maxRecommendedBots = scaling.maxBots;
    let limitingFactor: 'cpu' | 'memory' | 'network' = 'cpu';

    for (let botCount = scaling.minBots; botCount <= scaling.maxBots; botCount += scaling.stepSize) {
      const predicted = this.predictResourceUsage(
        botCount,
        adjustedBaseline,
        cpuScalingExp,
        memoryScalingExp,
        networkScalingExp
      );

      const feasibility = this.checkFeasibility(
        predicted,
        maxCpuPercent,
        maxMemoryGB,
        maxNetworkMbps
      );

      const step: SimulationStep = {
        botCount,
        predicted,
        feasibility
      };

      // Check if any limit reached
      if (!feasibility.overallFeasible) {
        if (!feasibility.cpuFeasible) {
          step.limitReached = {
            resource: 'cpu',
            utilizationPercent: (predicted.cpu.totalPercent / maxCpuPercent) * 100
          };
          if (maxRecommendedBots === scaling.maxBots) {
            maxRecommendedBots = Math.max(scaling.minBots, botCount - scaling.stepSize);
            limitingFactor = 'cpu';
          }
        } else if (!feasibility.memoryFeasible) {
          step.limitReached = {
            resource: 'memory',
            utilizationPercent: (predicted.memory.totalGB / maxMemoryGB) * 100
          };
          if (maxRecommendedBots === scaling.maxBots) {
            maxRecommendedBots = Math.max(scaling.minBots, botCount - scaling.stepSize);
            limitingFactor = 'memory';
          }
        } else if (!feasibility.networkFeasible) {
          step.limitReached = {
            resource: 'network',
            utilizationPercent: (predicted.network.totalMbps / maxNetworkMbps) * 100
          };
          if (maxRecommendedBots === scaling.maxBots) {
            maxRecommendedBots = Math.max(scaling.minBots, botCount - scaling.stepSize);
            limitingFactor = 'network';
          }
        }
      }

      results.push(step);
    }

    // Calculate recommendations for reaching 5000 bots
    const target5000 = this.predictResourceUsage(
      5000,
      adjustedBaseline,
      cpuScalingExp,
      memoryScalingExp,
      networkScalingExp
    );

    const toReach5000Bots: any = {};
    if (target5000.cpu.totalPercent > maxCpuPercent) {
      toReach5000Bots.cpuCoresNeeded = Math.ceil(target5000.cpu.coresNeeded);
    }
    if (target5000.memory.totalGB > maxMemoryGB) {
      toReach5000Bots.memoryGBNeeded = Math.ceil(target5000.memory.totalGB);
    }
    if (target5000.network.totalMbps > maxNetworkMbps) {
      toReach5000Bots.networkMbpsNeeded = Math.ceil(target5000.network.totalMbps);
    }

    // Build scaling curves
    const scalingCurves = {
      cpu: results.map(r => ({ bots: r.botCount, percent: r.predicted.cpu.totalPercent })),
      memory: results.map(r => ({ bots: r.botCount, mb: r.predicted.memory.totalMB })),
      network: results.map(r => ({ bots: r.botCount, mbps: r.predicted.network.totalMbps }))
    };

    const totalSimulationTime = performance.now() - start;

    return {
      simulation: {
        rangeSimulated: { min: scaling.minBots, max: scaling.maxBots },
        steps: results.length,
        totalSimulationTime
      },
      results,
      recommendations: {
        maxRecommendedBots,
        limitingFactor,
        toReach5000Bots: Object.keys(toReach5000Bots).length > 0 ? toReach5000Bots : undefined
      },
      scalingCurves
    };
  }

  /**
   * Predict resource usage for a given bot count
   */
  predictResourceUsage(
    botCount: number,
    baseline: BaselineMetrics,
    cpuScalingExp: number,
    memoryScalingExp: number,
    networkScalingExp: number
  ): ResourcePrediction {
    // Non-linear scaling formulas
    // CPU: Accounts for cache contention, lock contention, context switching
    const cpuScalingFactor = Math.pow(1 + 0.0001 * botCount, cpuScalingExp - 1);
    const totalCpu = botCount * baseline.cpuPerBot * cpuScalingFactor;

    // Memory: Accounts for fragmentation, metadata overhead
    const memoryScalingFactor = Math.pow(1 + 0.00005 * botCount, memoryScalingExp - 1);
    const totalMemoryMB = botCount * baseline.memoryPerBotMB * memoryScalingFactor;

    // Network: Mostly linear, slight overhead from packet headers
    const networkScalingFactor = Math.pow(1 + 0.00002 * botCount, networkScalingExp - 1);
    const totalNetworkKBps = botCount * baseline.networkPerBotKBps * networkScalingFactor;

    return {
      cpu: {
        totalPercent: totalCpu,
        perBotPercent: totalCpu / botCount,
        coresNeeded: Math.ceil(totalCpu / 100)
      },
      memory: {
        totalMB: totalMemoryMB,
        totalGB: totalMemoryMB / 1024,
        perBotMB: totalMemoryMB / botCount
      },
      network: {
        totalMbps: (totalNetworkKBps * 8) / 1024,
        perBotKbps: totalNetworkKBps / botCount
      }
    };
  }

  /**
   * Check if resource usage is within limits
   */
  private checkFeasibility(
    predicted: ResourcePrediction,
    maxCpuPercent: number,
    maxMemoryGB: number,
    maxNetworkMbps: number
  ): Feasibility {
    const cpuFeasible = predicted.cpu.totalPercent <= maxCpuPercent;
    const memoryFeasible = predicted.memory.totalGB <= maxMemoryGB;
    const networkFeasible = predicted.network.totalMbps <= maxNetworkMbps;

    return {
      cpuFeasible,
      memoryFeasible,
      networkFeasible,
      overallFeasible: cpuFeasible && memoryFeasible && networkFeasible
    };
  }

  /**
   * Calculate optimal bot count for given resource constraints
   */
  async findOptimalBotCount(
    baseline: BaselineMetrics,
    limits: ResourceLimits,
    activityLevel: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat' = 'moderate'
  ): Promise<{
    optimalBotCount: number;
    limitingFactor: 'cpu' | 'memory' | 'network';
    resourceUtilization: {
      cpu: number;
      memory: number;
      network: number;
    };
  }> {
    const activityMult = this.activityMultipliers[activityLevel];
    const adjustedBaseline: BaselineMetrics = {
      cpuPerBot: baseline.cpuPerBot * activityMult.cpu,
      memoryPerBotMB: baseline.memoryPerBotMB * activityMult.memory,
      networkPerBotKBps: baseline.networkPerBotKBps * activityMult.network
    };

    const maxCpuPercent = limits.maxCpuPercent ?? 80;
    const maxMemoryGB = limits.maxMemoryGB ?? 16;
    const maxNetworkMbps = limits.maxNetworkMbps ?? 1000;

    // Binary search for optimal bot count
    let low = 1;
    let high = 10000;
    let optimalBotCount = 1;
    let limitingFactor: 'cpu' | 'memory' | 'network' = 'cpu';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      const predicted = this.predictResourceUsage(mid, adjustedBaseline, 1.2, 1.05, 1.0);
      const feasibility = this.checkFeasibility(predicted, maxCpuPercent, maxMemoryGB, maxNetworkMbps);

      if (feasibility.overallFeasible) {
        optimalBotCount = mid;
        low = mid + 1;
      } else {
        // Determine limiting factor
        if (!feasibility.cpuFeasible) {
          limitingFactor = 'cpu';
        } else if (!feasibility.memoryFeasible) {
          limitingFactor = 'memory';
        } else {
          limitingFactor = 'network';
        }
        high = mid - 1;
      }
    }

    // Calculate final utilization
    const finalPrediction = this.predictResourceUsage(optimalBotCount, adjustedBaseline, 1.2, 1.05, 1.0);

    return {
      optimalBotCount,
      limitingFactor,
      resourceUtilization: {
        cpu: (finalPrediction.cpu.totalPercent / maxCpuPercent) * 100,
        memory: (finalPrediction.memory.totalGB / maxMemoryGB) * 100,
        network: (finalPrediction.network.totalMbps / maxNetworkMbps) * 100
      }
    };
  }

  /**
   * Generate scaling curve data points for visualization
   */
  generateScalingCurve(
    baseline: BaselineMetrics,
    activityLevel: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat',
    minBots: number,
    maxBots: number,
    points: number = 50
  ): {
    cpu: Array<{ bots: number; percent: number; }>;
    memory: Array<{ bots: number; gb: number; }>;
    network: Array<{ bots: number; mbps: number; }>;
  } {
    const activityMult = this.activityMultipliers[activityLevel];
    const adjustedBaseline: BaselineMetrics = {
      cpuPerBot: baseline.cpuPerBot * activityMult.cpu,
      memoryPerBotMB: baseline.memoryPerBotMB * activityMult.memory,
      networkPerBotKBps: baseline.networkPerBotKBps * activityMult.network
    };

    const step = Math.ceil((maxBots - minBots) / points);
    const cpu: Array<{ bots: number; percent: number; }> = [];
    const memory: Array<{ bots: number; gb: number; }> = [];
    const network: Array<{ bots: number; mbps: number; }> = [];

    for (let bots = minBots; bots <= maxBots; bots += step) {
      const predicted = this.predictResourceUsage(bots, adjustedBaseline, 1.2, 1.05, 1.0);

      cpu.push({ bots, percent: predicted.cpu.totalPercent });
      memory.push({ bots, gb: predicted.memory.totalGB });
      network.push({ bots, mbps: predicted.network.totalMbps });
    }

    return { cpu, memory, network };
  }

  /**
   * Compare different activity levels
   */
  compareActivityLevels(
    baseline: BaselineMetrics,
    botCount: number
  ): {
    [activityLevel: string]: ResourcePrediction;
  } {
    const results: { [key: string]: ResourcePrediction } = {};

    for (const level of ['idle', 'light', 'moderate', 'heavy', 'combat'] as const) {
      const activityMult = this.activityMultipliers[level];
      const adjustedBaseline: BaselineMetrics = {
        cpuPerBot: baseline.cpuPerBot * activityMult.cpu,
        memoryPerBotMB: baseline.memoryPerBotMB * activityMult.memory,
        networkPerBotKBps: baseline.networkPerBotKBps * activityMult.network
      };

      results[level] = this.predictResourceUsage(botCount, adjustedBaseline, 1.2, 1.05, 1.0);
    }

    return results;
  }
}
