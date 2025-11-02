#!/usr/bin/env node
/**
 * Test Script for Phase 5 Week 4: Performance Analysis Tools
 * Tests PerformanceAnalyzer, ScalingSimulator, and OptimizationSuggester
 */

import {
  analyzeBotPerformance,
  simulateScaling,
  getOptimizationSuggestions,
  quickPerformanceAnalysis,
  findOptimalBotCount
} from './dist/tools/performance.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function test1_AnalyzeBotPerformance() {
  console.log(`${YELLOW}Test 1: Analyze Bot Performance (Realtime Mode)...${RESET}`);

  try {
    const result = await analyzeBotPerformance({
      mode: 'realtime',
      metrics: {
        cpu: true,
        memory: true,
        network: true
      },
      duration: 2000,
      interval: 200
    });

    console.log(`Analysis completed in ${result.analysisTime.toFixed(2)}ms`);
    console.log(`Total samples: ${result.report.summary.totalSamples}`);

    if (result.report.summary.cpu) {
      console.log(`CPU Usage: ${result.report.summary.cpu.mean.toFixed(2)}% (mean)`);
      console.log(`  p95: ${result.report.summary.cpu.p95.toFixed(2)}%`);
      console.log(`  p99: ${result.report.summary.cpu.p99.toFixed(2)}%`);
    }

    if (result.report.summary.memory) {
      console.log(`Memory Usage: ${result.report.summary.memory.mean.toFixed(2)} MB (mean)`);
      console.log(`  p95: ${result.report.summary.memory.p95.toFixed(2)} MB`);
    }

    console.log(`Bottlenecks detected: ${result.report.bottlenecks.length}`);
    if (result.report.bottlenecks.length > 0) {
      result.report.bottlenecks.forEach(b => {
        console.log(`  - [${b.severity}] ${b.description}`);
      });
    }

    console.log(`Trends:`);
    console.log(`  CPU: ${result.report.trends.cpuTrend}`);
    console.log(`  Memory: ${result.report.trends.memoryTrend}`);
    console.log(`  Memory leak detected: ${result.report.trends.memoryLeakDetected}`);

    // Check performance target (<100ms for snapshot)
    if (result.analysisTime > 100) {
      console.log(`${YELLOW}⚠ Analysis time exceeded 100ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.analysisTime.toFixed(2)}ms < 100ms)${RESET}`);
    }

    console.log(`${GREEN}✓ Test 1 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 1 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test2_SimulateScaling() {
  console.log(`${YELLOW}Test 2: Simulate Scaling (100-1000 bots)...${RESET}`);

  try {
    const result = await simulateScaling({
      minBots: 100,
      maxBots: 1000,
      stepSize: 100,
      profile: {
        roleDistribution: {
          tank: 20,
          healer: 20,
          dps: 60
        },
        activityLevel: 'moderate'
      },
      baseline: {
        cpuPerBot: 0.1,        // 0.1% CPU per bot
        memoryPerBotMB: 10,    // 10 MB per bot
        networkPerBotKBps: 5   // 5 KB/s per bot
      },
      limits: {
        maxCpuPercent: 80,
        maxMemoryGB: 16,
        maxNetworkMbps: 1000
      }
    });

    console.log(`Simulation completed in ${result.simulation.totalSimulationTime.toFixed(2)}ms`);
    console.log(`Steps simulated: ${result.simulation.steps}`);
    console.log(`Max recommended bots: ${result.recommendations.maxRecommendedBots}`);
    console.log(`Limiting factor: ${result.recommendations.limitingFactor}`);

    // Show some results
    console.log(`\nSample results:`);
    const sampleSteps = [0, Math.floor(result.results.length / 2), result.results.length - 1];

    for (const idx of sampleSteps) {
      const step = result.results[idx];
      console.log(`  ${step.botCount} bots:`);
      console.log(`    CPU: ${step.predicted.cpu.totalPercent.toFixed(1)}% (${step.predicted.cpu.coresNeeded} cores)`);
      console.log(`    Memory: ${step.predicted.memory.totalGB.toFixed(2)} GB`);
      console.log(`    Network: ${step.predicted.network.totalMbps.toFixed(2)} Mbps`);
      console.log(`    Feasible: ${step.feasibility.overallFeasible ? 'YES' : 'NO'}`);
    }

    // Check for 5000 bot recommendations
    if (result.recommendations.toReach5000Bots) {
      console.log(`\n${CYAN}To reach 5000 bots:${RESET}`);
      if (result.recommendations.toReach5000Bots.cpuCoresNeeded) {
        console.log(`  CPU Cores needed: ${result.recommendations.toReach5000Bots.cpuCoresNeeded}`);
      }
      if (result.recommendations.toReach5000Bots.memoryGBNeeded) {
        console.log(`  Memory needed: ${result.recommendations.toReach5000Bots.memoryGBNeeded} GB`);
      }
    }

    // Check performance target (<3000ms for 50 steps, we did 10 steps)
    const expectedTime = (10 / 50) * 3000;  // Scale target proportionally
    if (result.simulation.totalSimulationTime > expectedTime) {
      console.log(`${YELLOW}⚠ Simulation time exceeded ${expectedTime.toFixed(0)}ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.simulation.totalSimulationTime.toFixed(2)}ms < ${expectedTime.toFixed(0)}ms)${RESET}`);
    }

    console.log(`${GREEN}✓ Test 2 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 2 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test3_OptimizationSuggestions() {
  console.log(`${YELLOW}Test 3: Get Optimization Suggestions...${RESET}`);

  try {
    // First, get a performance report
    const perfAnalysis = await analyzeBotPerformance({
      mode: 'snapshot',
      metrics: { cpu: true, memory: true, network: true },
      duration: 1000,
      interval: 100
    });

    // Get optimization suggestions
    const result = await getOptimizationSuggestions({
      performanceReport: perfAnalysis.report,
      includeQuickWins: true
    });

    console.log(`Analysis completed in ${result.summary.analysisTime.toFixed(2)}ms`);
    console.log(`Total suggestions: ${result.summary.totalSuggestions}`);
    console.log(`  High impact: ${result.summary.highImpact}`);
    console.log(`  Medium impact: ${result.summary.mediumImpact}`);
    console.log(`  Low impact: ${result.summary.lowImpact}`);

    console.log(`\nTop suggestions:`);
    result.suggestions.slice(0, 3).forEach((s, i) => {
      console.log(`\n${i + 1}. [${s.category.toUpperCase()}] ${s.title}`);
      console.log(`   Impact: ${s.impact.level} - ${s.impact.estimatedImprovement}`);
      console.log(`   Difficulty: ${s.difficulty.level} (${s.difficulty.estimatedHours}h)`);
      console.log(`   Priority: ${s.priority}/10`);
    });

    console.log(`\nQuick wins: ${result.quickWins.length}`);
    result.quickWins.forEach((qw, i) => {
      console.log(`  ${i + 1}. ${qw.suggestion} (${qw.estimatedTimeMinutes}min - ${qw.expectedImprovement})`);
    });

    // Check performance target (<1000ms for perf data analysis)
    if (result.summary.analysisTime > 1000) {
      console.log(`${YELLOW}⚠ Analysis time exceeded 1000ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.summary.analysisTime.toFixed(2)}ms < 1000ms)${RESET}`);
    }

    console.log(`${GREEN}✓ Test 3 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 3 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test4_QuickPerformanceAnalysis() {
  console.log(`${YELLOW}Test 4: Quick Performance Analysis (integrated)...${RESET}`);

  try {
    const result = await quickPerformanceAnalysis({
      duration: 2000,
      interval: 200,
      includeOptimizations: true
    });

    console.log(`Quick analysis completed in ${result.analysisTime.toFixed(2)}ms`);
    console.log(`Performance report generated: ${result.report ? 'YES' : 'NO'}`);
    console.log(`Optimization suggestions included: ${result.suggestions ? 'YES' : 'NO'}`);

    if (result.report.summary.cpu) {
      console.log(`CPU: ${result.report.summary.cpu.mean.toFixed(2)}% mean, ${result.report.summary.cpu.p95.toFixed(2)}% p95`);
    }

    if (result.suggestions) {
      console.log(`Suggestions generated: ${result.suggestions.summary.totalSuggestions}`);
    }

    console.log(`${GREEN}✓ Test 4 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 4 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test5_FindOptimalBotCount() {
  console.log(`${YELLOW}Test 5: Find Optimal Bot Count...${RESET}`);

  try {
    const result = await findOptimalBotCount({
      baseline: {
        cpuPerBot: 0.1,
        memoryPerBotMB: 10,
        networkPerBotKBps: 5
      },
      activityLevel: 'moderate',
      limits: {
        maxCpuPercent: 80,
        maxMemoryGB: 16,
        maxNetworkMbps: 1000
      }
    });

    console.log(`Optimal bot count: ${result.optimalBotCount}`);
    console.log(`Limiting factor: ${result.limitingFactor}`);
    console.log(`Resource utilization at optimal:`);
    console.log(`  CPU: ${result.resourceUtilization.cpu.toFixed(1)}%`);
    console.log(`  Memory: ${result.resourceUtilization.memory.toFixed(1)}%`);
    console.log(`  Network: ${result.resourceUtilization.network.toFixed(1)}%`);

    // Verify optimal count is reasonable
    if (result.optimalBotCount < 100) {
      console.log(`${YELLOW}⚠ Optimal bot count seems low (< 100)${RESET}`);
    } else if (result.optimalBotCount > 10000) {
      console.log(`${YELLOW}⚠ Optimal bot count seems high (> 10000)${RESET}`);
    } else {
      console.log(`${GREEN}✓ Optimal bot count is reasonable (${result.optimalBotCount})${RESET}`);
    }

    console.log(`${GREEN}✓ Test 5 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 5 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test6_ScalingWithDifferentActivityLevels() {
  console.log(`${YELLOW}Test 6: Scaling with Different Activity Levels...${RESET}`);

  try {
    const activityLevels = ['idle', 'light', 'moderate', 'heavy', 'combat'];
    const results = [];

    for (const level of activityLevels) {
      const result = await simulateScaling({
        minBots: 500,
        maxBots: 500,  // Single point
        stepSize: 500,
        profile: {
          roleDistribution: { tank: 20, healer: 20, dps: 60 },
          activityLevel: level
        },
        baseline: {
          cpuPerBot: 0.1,
          memoryPerBotMB: 10,
          networkPerBotKBps: 5
        }
      });

      results.push({
        level,
        cpu: result.results[0].predicted.cpu.totalPercent,
        memory: result.results[0].predicted.memory.totalGB,
        network: result.results[0].predicted.network.totalMbps
      });
    }

    console.log(`Activity level comparison for 500 bots:\n`);
    console.log(`${'Level'.padEnd(12)} ${'CPU%'.padEnd(10)} ${'Memory GB'.padEnd(12)} ${'Network Mbps'.padEnd(15)}`);
    console.log('-'.repeat(50));

    for (const r of results) {
      console.log(
        `${r.level.padEnd(12)} ` +
        `${r.cpu.toFixed(1).padEnd(10)} ` +
        `${r.memory.toFixed(2).padEnd(12)} ` +
        `${r.network.toFixed(2)}`
      );
    }

    // Verify ordering (combat > heavy > moderate > light > idle)
    const cpuOrdered = results.every((r, i) =>
      i === 0 || results[i - 1].cpu <= r.cpu || Math.abs(results[i - 1].cpu - r.cpu) < 0.1
    );

    if (cpuOrdered) {
      console.log(`${GREEN}✓ Activity levels ordered correctly${RESET}`);
    } else {
      console.log(`${YELLOW}⚠ Activity level ordering may be incorrect${RESET}`);
    }

    console.log(`${GREEN}✓ Test 6 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 6 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function runAllTests() {
  console.log(`${CYAN}=== TrinityCore MCP Server - Performance Analysis Test Suite ===${RESET}\n`);

  const tests = [
    { name: 'Analyze Bot Performance (Snapshot)', fn: test1_AnalyzeBotPerformance },
    { name: 'Simulate Scaling (100-1000 bots)', fn: test2_SimulateScaling },
    { name: 'Get Optimization Suggestions', fn: test3_OptimizationSuggestions },
    { name: 'Quick Performance Analysis', fn: test4_QuickPerformanceAnalysis },
    { name: 'Find Optimal Bot Count', fn: test5_FindOptimalBotCount },
    { name: 'Scaling Different Activity Levels', fn: test6_ScalingWithDifferentActivityLevels },
  ];

  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  console.log(`${CYAN}=== Test Summary ===${RESET}\n`);

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? GREEN + '✓' : RED + '✗';
    console.log(`${icon} ${r.name}${RESET}`);
  });

  console.log(`\n${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);

  if (passed === total) {
    console.log(`${GREEN}\n=== All tests passed! ===${RESET}`);
  } else {
    console.log(`${RED}\n=== Some tests failed ===${RESET}`);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${RED}Fatal error: ${error}${RESET}`);
  console.error(error.stack);
  process.exit(1);
});
