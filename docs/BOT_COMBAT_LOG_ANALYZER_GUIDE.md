# Bot Combat Log Analyzer - User Guide

Comprehensive guide for analyzing bot combat performance with ML-powered insights and actionable recommendations.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [Getting Started](#getting-started)
4. [Using the Analyzer](#using-the-analyzer)
5. [Understanding the Analysis](#understanding-the-analysis)
6. [Recommendations](#recommendations)
7. [Advanced Topics](#advanced-topics)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

---

## Introduction

The Bot Combat Log Analyzer is an enterprise-grade tool for analyzing World of Warcraft bot combat performance. It uses machine learning algorithms to detect patterns, classify behavior, and generate actionable recommendations for bot optimization.

### What It Does

- **Parses Combat Logs**: Extracts events from WoW combat logs
- **Tracks Performance**: Monitors DPS, HPS, ability usage, cooldowns, and procs
- **Analyzes Mechanics**: Evaluates interrupts, CC usage, movement, and resource management
- **Detects Patterns**: Uses ML to identify playstyle patterns and behavior types
- **Compares Performance**: Benchmarks against class/spec baselines and population statistics
- **Generates Recommendations**: Provides prioritized, actionable improvement suggestions

### Architecture

```
Combat Log (txt/log)
    ↓
Combat Log Parser (botcombatloganalyzer.ts)
    ↓
┌────────────────────────────────────────────────────────┐
│ Specialized Analyzers                                   │
├────────────────────────────────────────────────────────┤
│ • Cooldown Tracker (cooldown-tracker.ts)               │
│ • Decision Tree Analyzer (decision-tree-analyzer.ts)   │
│ • Combat Mechanics (combat-mechanics-analyzer.ts)      │
│ • Pattern Detection ML (pattern-detection-ml.ts)       │
│ • Performance Comparison (performance-comparison.ts)   │
└────────────────────────────────────────────────────────┘
    ↓
Recommendation Engine (recommendation-engine.ts)
    ↓
Web UI Dashboard (web-ui/app/combat-log-analyzer/)
```

---

## Features

### 1. Combat Log Parsing

**Supported Event Types:**
- `SPELL_CAST`: Ability casts
- `SPELL_DAMAGE`: Damage dealt
- `SPELL_HEAL`: Healing done
- `SWING_DAMAGE`: Melee attacks
- `AURA_APPLIED`: Buffs/debuffs applied
- `AURA_REMOVED`: Buffs/debuffs removed
- `SPELL_INTERRUPT`: Interrupts

**Extracted Metrics:**
- Total damage/healing
- DPS/HPS
- Ability usage counts
- Cast times and sequences
- Critical hit rates
- Combat duration and uptime

### 2. Cooldown Tracking

**Monitors:**
- Ability cooldown usage and efficiency
- Missed casts (cooldown available but not used)
- Average delay between cooldown ready and use
- Proc buff tracking (uptime, wasted procs)
- Charge-based abilities

**Cooldown Database:** Includes 20+ common abilities for:
- Warrior (Mortal Strike, Bloodthirst, Recklessness)
- Mage (Combustion, Arcane Power, Icy Veins)
- Rogue (Cold Blood, Adrenaline Rush)
- Priest (Power Infusion, Greater Heal)

**Extensible:** Register custom cooldowns with `registerCooldown(spellId, info)`

### 3. Decision Tree Analysis

**Reconstructs Bot Logic:**
- Tracks game state (health, mana, buffs, target, position)
- Records decisions made at each state
- Builds hierarchical decision tree
- Identifies suboptimal decisions

**Pattern Detection:**
- Groups decisions by similar game states
- Finds most common actions per state
- Calculates success rates
- Detects recurring mistakes

**Quality Scoring:**
- Overall decision quality (0-100)
- Success rate per decision branch
- Comparison to optimal play

### 4. Combat Mechanics Analysis

**Interrupt Tracking:**
- Castable interrupts identified
- Successful interrupt timing
- Interrupt accuracy percentage
- Missed interrupt opportunities

**Crowd Control (CC) Analysis:**
- CC application and removal events
- Diminishing Returns (DR) tracking
- CC chain efficiency
- Wasted CC (broke early, overlapped)

**Movement Analysis (Limited):**
- Requires enhanced combat logs with position data
- Detects movement patterns
- Identifies repositioning frequency

**Resource Management:**
- Tracks mana/energy/rage usage
- Identifies resource starvation
- Detects resource waste

### 5. Machine Learning Pattern Detection

**Feature Extraction (18 Features):**
- **Combat Intensity:** Actions/second, DPS, HPS, movement frequency
- **Resource Management:** Avg mana%, efficiency, waste
- **Defensive Behavior:** Defensive CD usage, heal timing, interrupt success
- **Offensive Behavior:** Burst damage ratio, CD usage rate, target switching
- **Positioning:** Distance to target, reposition frequency
- **Decision Quality:** Optimal decision rate, reaction time, rotation score

**K-Means Clustering:**
- Groups combat sessions by behavioral patterns
- K-means++ initialization for better convergence
- Euclidean distance with normalization
- Automatic pattern labeling

**Behavior Classification (10 Types):**
1. **Expert**: High efficiency (80%+) + high reactivity (70%+)
2. **Aggressive-Burst**: High aggression + high burst damage ratio
3. **Aggressive-Sustained**: High aggression + consistent DPS
4. **Defensive-Reactive**: High caution + high reactivity
5. **Defensive-Proactive**: High caution + preemptive defensive usage
6. **Balanced-Optimal**: High efficiency + balanced aggression/caution
7. **Balanced-Safe**: Moderate across all dimensions
8. **Passive**: Low activity (<0.5 actions/sec)
9. **Chaotic**: Low efficiency (<50%) + inconsistent rotation
10. **Learning**: Moderate efficiency (40-70%)

**Sequence Analysis:**
- Extracts common ability sequences (3-10 spells)
- Identifies rotation patterns
- Calculates sequence effectiveness
- Finds most frequent combos

**Anomaly Detection:**
- Performance spikes (unusually high DPS)
- Performance drops (significant DPS decrease)
- Behavior shifts (decision quality changes)
- Resource mismanagement
- Unusual ability sequences

**Skill Level Calculation:**
- Weighted score: Decision quality (30%), Efficiency (25%), Rotation (20%), Reactivity (15%), Mechanics (10%)
- 0-100 scale

### 6. Performance Comparison

**Baseline Comparison:**
- Compares vs class/spec expected values
- Supports WoW Classic level 60 baselines
- Custom baselines via `registerBaseline()`

**Performance Ratings (S/A/B/C/D/F):**
- **S Grade:** 95%+ of expected (Exceptional)
- **A Grade:** 85-95% (Excellent)
- **B Grade:** 75-85% (Good)
- **C Grade:** 65-75% (Average)
- **D Grade:** 50-65% (Below Average)
- **F Grade:** <50% (Poor)

**Gap Analysis:**
- DPS gap vs expected
- HPS gap vs expected
- APM (actions per minute) gap
- Root cause diagnosis

**Ability Breakdown:**
- Per-ability DPS/HPS
- Cast efficiency
- Expected vs actual casts
- Contribution to total damage/healing

**Timeline Analysis:**
- Divides combat into segments
- Identifies phases (opener, sustained, burst, recovery)
- Tracks performance per phase

**Population Comparison:**
- Percentile ranking
- vs Average bot
- vs Top 10%
- vs Top 1%

**Historical Trends:**
- Track improvement over sessions
- Best/worst session identification
- Trend direction (improving/declining/stable)

### 7. Recommendation Engine

**Aggregates Insights from All Analyzers:**
- Decision tree issues
- Cooldown inefficiencies
- Proc usage problems
- Mechanics failures
- Pattern anomalies
- Performance gaps

**Prioritization (4 Levels):**
- **Critical:** Immediate attention required, major impact
- **High:** Significant impact, implement ASAP
- **Medium:** Moderate impact, plan for next iteration
- **Low:** Minor improvements, nice-to-have

**9 Categories:**
- Rotation optimization
- Cooldown management
- Resource efficiency
- Positioning
- Mechanics execution
- Decision-making
- Gear optimization
- Talent selection
- General improvements

**Impact Estimation:**
- DPS gain (estimated additional DPS)
- HPS gain (estimated additional HPS)
- Percentage gain (overall % improvement)
- Quality improvement (major/moderate/minor)

**Difficulty Rating:**
- **Easy:** 15-30 minutes, simple configuration
- **Medium:** 30-60 minutes, moderate complexity
- **Hard:** 1+ hours, requires significant refactoring

**Actionable Steps:**
- Step-by-step implementation guide
- Technical details included
- Code examples provided
- Testing instructions

**Improvement Roadmap:**
- **Quick Wins:** High impact + easy difficulty
- **Short-Term:** Implement within 1 week
- **Medium-Term:** Implement within 1 month
- **Long-Term:** Ongoing optimization

**Focus Areas:**
- Current score + target score
- Related recommendations
- Importance ranking

---

## Getting Started

### Prerequisites

1. **TrinityCore Server** with bot system
2. **Combat Logs** enabled:
   ```sql
   UPDATE worldstates SET value = 1 WHERE entry = 'combat_log_enabled';
   ```
3. **Node.js** 18+ and npm installed
4. **Web UI** running (Next.js development server)

### Installation

1. Install dependencies:
   ```bash
   cd web-ui
   npm install
   ```

2. Verify required packages:
   ```bash
   npm list d3 react-dropzone
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open browser:
   ```
   http://localhost:3000/combat-log-analyzer
   ```

### First Analysis

1. **Enable Combat Logging:**
   - In-game: `/combatlog` or enable in settings
   - File location: `World of Warcraft/_retail_/Logs/WoWCombatLog.txt`

2. **Extract Bot Combat:**
   - Filter log for specific bot: `grep "BotName" WoWCombatLog.txt > bot_combat.txt`
   - Or use a single fight segment

3. **Upload to Analyzer:**
   - Drag & drop `bot_combat.txt` to dashboard
   - Or click to browse files

4. **Configure Analysis:**
   - Enter bot name
   - Select class (Warrior, Mage, Rogue, Priest, etc.)
   - Specify spec (Arms, Fury, Fire, Frost, etc.)

5. **Run Analysis:**
   - Click "Analyze" or drop file
   - Wait 2-5 seconds for processing

6. **Review Results:**
   - Summary cards show key metrics
   - Performance gauge displays grade
   - Charts visualize data
   - Recommendations list improvements

---

## Using the Analyzer

### Dashboard Overview

**Top Section - Summary Cards:**
- **Duration:** Total combat time in seconds
- **DPS:** Damage per second
- **Total Damage:** Cumulative damage dealt
- **Percentile:** Ranking vs all bots

**Performance Gauge:**
- Radial gauge with animated arc
- Color-coded: Green (good) → Red (poor)
- Grade badge (S/A/B/C/D/F)
- Overall performance score (0-100)

**DPS Over Time Chart:**
- Line chart with area fill
- X-axis: Time (seconds)
- Y-axis: DPS
- Phase markers (opener, sustained, burst, execute)
- Average DPS line (green dashed)
- Hover for exact values

**Ability Breakdown Chart:**
- Horizontal bars by damage contribution
- Top 10 abilities displayed
- Hover for details:
  - Total damage/healing
  - Percentage of total
  - Cast count
  - Average per cast

**Combat Timeline:**
- Multi-lane event visualization
- 7 event types:
  - **Phase:** Red triangles (pull, sustained, burst, execute)
  - **Cooldown:** Blue rectangles (major CDs)
  - **Buff:** Green circles (beneficial effects)
  - **Debuff:** Orange circles (negative effects)
  - **Interrupt:** Purple circles (spell interrupts)
  - **Cast:** Gray circles (regular ability usage)
  - **Death:** Red triangles (deaths)
- Duration events show as bars
- Instant events show as markers
- Hover for event details

**Recommendations Section:**
- Color-coded by priority:
  - Red: Critical
  - Orange: High
  - Yellow: Medium
- Each recommendation shows:
  - Priority badge
  - Category tag
  - Title and description
  - Estimated impact
- Click to expand action steps (future feature)

**Key Insights:**
- Bullet-point list
- ML-generated observations
- Behavior classification
- Top patterns identified

### Interactive Features

**File Upload:**
- Drag & drop supported
- Click to browse
- Accepts .txt and .log files
- Max 1 file at a time

**Configuration:**
- Bot Name: Free text input
- Class: Dropdown (Warrior, Mage, Rogue, etc.)
- Spec: Free text input (Arms, Fury, etc.)

**Reset:**
- "Analyze Another Log" button
- Clears current results
- Returns to upload screen

**Dark Mode:**
- Auto-detects system preference
- Toggle in header (if implemented)
- All charts adapt to theme

### Keyboard Shortcuts

(Future feature - can be added)
- `Ctrl/Cmd + U`: Upload new log
- `Ctrl/Cmd + R`: Reset analysis
- `Esc`: Close modals

---

## Understanding the Analysis

### Performance Metrics

**DPS (Damage Per Second):**
- Formula: `Total Damage / Combat Duration`
- Includes:
  - Direct damage from abilities
  - DoT (Damage over Time) ticks
  - Auto-attacks (white damage)
  - Pet damage (if applicable)
- Excludes:
  - Overkill damage
  - Damage to non-hostile targets

**HPS (Healing Per Second):**
- Formula: `Total Healing / Combat Duration`
- Includes:
  - Direct heals
  - HoT (Heal over Time) ticks
  - Self-healing
- Excludes:
  - Overhealing (future feature)

**APM (Actions Per Minute):**
- Formula: `(Total Casts / Duration) * 60`
- Counts:
  - Spell casts
  - Ability activations
  - Cooldown usage
- Excludes:
  - Auto-attacks
  - Passive procs

**Combat Uptime:**
- Percentage of time actively in combat
- Formula: `(Active Time / Total Duration) * 100`
- High uptime (95%+) = good
- Low uptime (<80%) = positioning issues or downtime

**Crit Rate:**
- Percentage of attacks that critically hit
- Formula: `(Critical Hits / Total Hits) * 100`
- Class-dependent baseline:
  - Melee DPS: 25-35%
  - Spell DPS: 15-25%
  - Healers: 10-20%

### Cooldown Efficiency

**Formula:**
```
Efficiency = (Actual Casts / Expected Casts) * 100
```

**Expected Casts Calculation:**
```
Expected = Floor(Combat Duration / Cooldown Duration) + 1
```
- +1 accounts for initial cast at pull

**Efficiency Ranges:**
- 90-100%: Excellent (using CD on cooldown)
- 70-90%: Good (minor delays)
- 50-70%: Fair (significant waste)
- <50%: Poor (major issues)

**Wasted Time:**
- Time cooldown was available but not used
- Formula: `Sum(Cast Time - Availability Time)` for each cast after first
- High waste = bot not checking cooldowns frequently enough

**Average Delay:**
- Formula: `Total Wasted Time / Number of Casts`
- Target: <1 second
- >2 seconds = check frequency issue
- >5 seconds = rotation priority problem

### Proc Usage

**Uptime Calculation:**
```
Uptime = (Total Active Time / Combat Duration) * 100
```

**Wasted Procs:**
- Occurs when:
  - Proc refreshed while already active
  - Proc expires without being used
- Impact: Lost potential uptime and DPS/HPS

**Recommendations:**
- Uptime target: 80%+ for high-value procs
- Zero wasted procs ideal
- React within 1 second of proc

### Decision Quality

**Optimal Decision Rate:**
```
ODR = (Optimal Decisions / Total Decisions) * 100
```

**Decision Evaluation Criteria:**
- Health management (heal timing, defensive CD usage)
- Resource efficiency (mana/energy conservation)
- Ability priority (using best ability for situation)
- Cooldown alignment (stacking CDs properly)
- Target selection (switching appropriately)

**Quality Ranges:**
- 90-100%: Expert-level AI
- 75-90%: Good AI, minor issues
- 60-75%: Average AI, notable mistakes
- <60%: Poor AI, systematic problems

### Behavior Types

**Aggression Score:**
- High DPS output
- Frequent cooldown usage
- Burst damage windows
- Target switching

**Caution Score:**
- Defensive ability usage
- Healing at high health
- Conservative resource management
- Avoidance of risky plays

**Efficiency Score:**
- Optimal decision rate
- Rotation consistency
- Resource management
- Minimal waste

**Reactivity Score:**
- Fast reaction time
- Successful interrupts
- Quick defensive responses
- Adaptive behavior

### Performance Grades

**Grading Scale:**

| Grade | Score Range | Label | Description |
|-------|-------------|-------|-------------|
| S | 95-100% | Exceptional | Top-tier performance, nearly perfect execution |
| A | 85-95% | Excellent | Strong performance, minor optimization possible |
| B | 75-85% | Good | Solid performance, some improvement areas |
| C | 65-75% | Average | Acceptable but needs work |
| D | 50-65% | Below Average | Significant issues, priority fixes needed |
| F | 0-50% | Poor | Major problems, comprehensive review required |

**Grade Calculation:**
- DPS/HPS: 40% weight
- Decision Quality: 25% weight
- Cooldown Efficiency: 15% weight
- Mechanics Execution: 10% weight
- Rotation Consistency: 10% weight

**Percentile Rankings:**
- Based on population of analyzed bots
- Updated with each analysis (simulated in demo)
- Compares to same class/spec when possible
- Uses weighted scoring algorithm

---

## Recommendations

### Priority Levels

**Critical Priority:**
- Immediate action required
- Major performance impact (10%+ gain potential)
- Fundamental issues (missing rotations, broken mechanics)
- Examples:
  - Bot not using core abilities
  - Decision logic errors causing 50%+ optimal rate
  - Critical cooldowns never used

**High Priority:**
- Implement ASAP (within 1 week)
- Significant impact (5-10% gain)
- Important but not game-breaking
- Examples:
  - Cooldown efficiency <70%
  - Multiple wasted procs
  - Low interrupt accuracy

**Medium Priority:**
- Plan for next iteration (within 1 month)
- Moderate impact (2-5% gain)
- Optimization opportunities
- Examples:
  - Average delay on cooldowns
  - Suboptimal ability priority
  - Minor mechanics issues

**Low Priority:**
- Nice-to-have improvements
- Minor impact (<2% gain)
- Polish and refinement
- Examples:
  - Very rare edge cases
  - Small efficiency gains
  - Quality-of-life improvements

### Implementation Guide

**For Cooldown Recommendations:**

1. **Locate Cooldown Logic:**
   ```cpp
   // In bot AI update loop
   void UpdateAI(uint32 diff) {
       // Check cooldowns section
   }
   ```

2. **Add Cooldown Check:**
   ```cpp
   if (CanCast(SPELL_RECKLESSNESS)) {
       DoCast(me, SPELL_RECKLESSNESS);
       return;
   }
   ```

3. **Adjust Priority:**
   - Move cooldown check earlier in rotation
   - Increase check frequency (every 0.5s instead of 1s)

4. **Test Changes:**
   - Run test combat scenario
   - Extract new combat log
   - Re-analyze to verify improvement

**For Decision Logic Recommendations:**

1. **Identify Decision Point:**
   ```cpp
   // Example: Healing decision
   if (HealthPercent() < threshold) {
       // Healing logic
   }
   ```

2. **Adjust Threshold:**
   ```cpp
   // OLD: if (HealthPercent() < 95)
   // NEW: if (HealthPercent() < 70)
   ```

3. **Add Conditions:**
   ```cpp
   if (HealthPercent() < 70 && !HasAura(REJUVENATION)) {
       DoCast(REJUVENATION);
   }
   ```

4. **Retest:**
   - Verify optimal decision rate increased
   - Check for unintended consequences

**For Rotation Recommendations:**

1. **Review Ability Priority:**
   ```cpp
   // Typical priority list structure
   if (CanCast(HIGH_PRIORITY_SPELL)) {
       DoCast(HIGH_PRIORITY_SPELL);
       return;
   }
   if (CanCast(MEDIUM_PRIORITY_SPELL)) {
       DoCast(MEDIUM_PRIORITY_SPELL);
       return;
   }
   // etc.
   ```

2. **Reorder Based on Recommendations:**
   - Move underused abilities higher
   - Demote overused filler abilities

3. **Add Conditionals:**
   ```cpp
   // Use execute in execute range
   if (target->HealthPercent() < 20 && CanCast(EXECUTE)) {
       DoCast(EXECUTE);
       return;
   }
   ```

### Best Practices

**Before Making Changes:**
1. ✅ Analyze current performance baseline
2. ✅ Prioritize recommendations by impact
3. ✅ Understand root cause of issue
4. ✅ Plan implementation approach
5. ✅ Backup current bot configuration

**During Implementation:**
1. ✅ Make one change at a time
2. ✅ Test each change independently
3. ✅ Document what was changed
4. ✅ Verify no regressions introduced
5. ✅ Use version control (git commit)

**After Implementation:**
1. ✅ Run new combat logs
2. ✅ Re-analyze with tool
3. ✅ Compare before/after metrics
4. ✅ Verify expected improvement
5. ✅ Iterate if needed

**Common Pitfalls:**
- ❌ Changing multiple things at once (can't isolate impact)
- ❌ Not testing thoroughly (regressions)
- ❌ Ignoring side effects (heal spam, resource starvation)
- ❌ Over-optimizing for specific scenario (generalization issues)
- ❌ Not re-analyzing after changes (no validation)

---

## Advanced Topics

### Custom Cooldown Registration

For abilities not in the default database:

```typescript
import { registerCooldown } from "@/src/tools/cooldown-tracker";

registerCooldown(12345, {
  spellId: 12345,
  spellName: "Custom Ability",
  cooldownDuration: 30000, // 30 seconds in milliseconds
  charges: 2, // Optional: for charge-based abilities
  chargeRecoveryTime: 15000, // Optional: 15s per charge
});
```

### Custom Performance Baseline

For custom bot classes or specs:

```typescript
import { registerBaseline } from "@/src/tools/performance-comparison";

registerBaseline("custom-class-spec-60", {
  class: "CustomClass",
  spec: "CustomSpec",
  level: 60,
  expectedDPS: 650,
  expectedHPS: 0,
  expectedAPM: 32,
  expectedCritRate: 28,
  expectedUptime: 95,
  source: "manual",
  confidence: 90,
});
```

### Historical Trend Tracking

Track bot improvement over time:

```typescript
import { PerformanceComparisonEngine } from "@/src/tools/performance-comparison";

const engine = new PerformanceComparisonEngine();

// Add historical data
for (const session of pastSessions) {
  engine.addHistoricalData(botId, session.metrics);
}

// Generate report with trend analysis
const report = engine.generateReport(currentMetrics, "Warrior", "Arms", 60, botId);
console.log(report.historicalTrend);
// { trend: "improving", trendPercent: 8.5, sessions: 10, ... }
```

### Batch Analysis

Analyze multiple bots at once:

```bash
# Script to batch analyze
for log in logs/*.txt; do
  node analyze.js "$log"
done
```

### MCP Integration

Call analyzer tools from MCP:

```typescript
// From MCP server
const result = await server.callTool("analyze_combat_log", {
  logPath: "/path/to/combat.log",
  botName: "TestBot",
  className: "Warrior",
  spec: "Arms",
});

console.log(result.performance.grade); // "A"
console.log(result.recommendations.length); // 5
```

### Export Reports

Generate PDF or JSON reports:

```typescript
// JSON export
const reportJSON = JSON.stringify(analysisResult, null, 2);
fs.writeFileSync("report.json", reportJSON);

// Text export
import { formatPerformanceReport, formatRecommendationReport } from "@/src/tools/*";

const performanceText = formatPerformanceReport(performanceReport);
const recommendationsText = formatRecommendationReport(recommendationReport);

fs.writeFileSync("report.txt", performanceText + "\n\n" + recommendationsText);
```

---

## Troubleshooting

### Common Issues

**Issue: "Failed to parse combat log"**
- **Cause:** Invalid log format or corrupted file
- **Solution:**
  1. Verify log is from WoW combat log (not addon logs)
  2. Check file encoding (should be UTF-8)
  3. Ensure file contains actual combat events
  4. Try filtering log for specific bot/timeframe

**Issue: "No data for bot [BotName]"**
- **Cause:** Bot name not found in log
- **Solution:**
  1. Check exact spelling of bot name (case-sensitive)
  2. Verify bot actually participated in combat
  3. Use `grep "BotName" combatlog.txt` to verify presence
  4. Try wildcard match if bot has suffix (e.g., "Bot-Server")

**Issue: "Performance baseline not found"**
- **Cause:** Unsupported class/spec combination
- **Solution:**
  1. Use generic class baseline (without spec)
  2. Register custom baseline (see Advanced Topics)
  3. Check for typos in class/spec names
  4. Update BASELINE_DATABASE in performance-comparison.ts

**Issue: "Analysis very slow"**
- **Cause:** Large combat log file (>100MB)
- **Solution:**
  1. Filter log to specific fight: `sed -n '/ENCOUNTER_START/,/ENCOUNTER_END/p' log.txt`
  2. Extract only bot's events: `grep "BotName" log.txt`
  3. Limit time range: `awk '/timestamp >= start && timestamp <= end/' log.txt`
  4. Increase timeout in MCP call

**Issue: "Recommendations seem wrong"**
- **Cause:** Incorrect class/spec, or unusual combat scenario
- **Solution:**
  1. Verify correct class/spec selected
  2. Check if combat was typical (not testing/unusual circumstances)
  3. Review analyzer assumptions in decision-tree-analyzer.ts
  4. Adjust evaluation criteria for your use case

**Issue: "Charts not rendering"**
- **Cause:** D3.js not loaded, or browser compatibility
- **Solution:**
  1. Check browser console for errors
  2. Verify D3 installed: `npm list d3`
  3. Try different browser (Chrome/Firefox recommended)
  4. Clear browser cache and reload

**Issue: "Percentile ranking seems off"**
- **Cause:** Limited historical data or simulation mode
- **Solution:**
  1. Note: Demo uses simulated percentiles
  2. For real rankings, need population database
  3. Implement backend storage for bot performances
  4. Calculate true percentiles from stored data

### Debug Mode

Enable verbose logging:

```typescript
// In botcombatloganalyzer.ts
const DEBUG = true;

if (DEBUG) {
  console.log("[DEBUG] Processing entry:", entry);
}
```

### Performance Optimization

For large datasets:

1. **Limit Timeline Events:**
   ```typescript
   // Only show major events
   const timeline = allEvents.filter(e =>
     e.type === "phase" ||
     e.type === "cooldown" ||
     e.importance === "high"
   );
   ```

2. **Sample DPS Data:**
   ```typescript
   // Sample every 5 seconds instead of 1
   const dpsOverTime = sampleData(allData, 5000);
   ```

3. **Lazy Load Charts:**
   ```typescript
   // Load charts on scroll or interaction
   const [showChart, setShowChart] = useState(false);
   ```

---

## API Reference

### Combat Log Parser

```typescript
import { parseCombatLog } from "@/src/tools/botcombatloganalyzer";

const entries: CombatLogEntry[] = parseCombatLog(logContent);
```

### Cooldown Tracker

```typescript
import { CooldownTracker, addCooldownAnalysisToCombatMetrics } from "@/src/tools/cooldown-tracker";

const { cooldownAnalyses, procAnalyses, missedOpportunities } =
  addCooldownAnalysisToCombatMetrics(entries, "BotName", duration);
```

### Decision Tree Analyzer

```typescript
import { analyzeDecisionMaking } from "@/src/tools/decision-tree-analyzer";

const analysis: DecisionTreeAnalysis = analyzeDecisionMaking(entries, "BotName");
```

### Combat Mechanics Analyzer

```typescript
import { analyzeCombatMechanics } from "@/src/tools/combat-mechanics-analyzer";

const report: CombatMechanicsReport = analyzeCombatMechanics(entries, "BotName");
```

### Pattern Detection ML

```typescript
import { analyzePatterns } from "@/src/tools/pattern-detection-ml";

const patterns: PatternDetectionResult = analyzePatterns(
  metrics,
  decisions,
  entries,
  historicalFeatures // optional
);
```

### Performance Comparison

```typescript
import { PerformanceComparisonEngine } from "@/src/tools/performance-comparison";

const engine = new PerformanceComparisonEngine();
const report: PerformanceReport = engine.generateReport(
  metrics,
  "Warrior",
  "Arms",
  60,
  "bot-123"
);
```

### Recommendation Engine

```typescript
import { RecommendationEngine } from "@/src/tools/recommendation-engine";

const engine = new RecommendationEngine();
const report: RecommendationReport = engine.generateRecommendations(
  decisionAnalysis,
  cooldownAnalyses,
  procAnalyses,
  mechanicsReport,
  patternResult,
  performanceReport
);
```

### Visualization Components

```typescript
import {
  DPSChart,
  PerformanceGauge,
  AbilityBreakdownChart,
  TimelineChart
} from "@/components/combat-log";

// See component props in web-ui/components/combat-log/index.ts
```

---

## Future Enhancements

**Planned Features:**
- [ ] E2E tests with Playwright
- [ ] Comparison mode (compare 2+ bots side-by-side)
- [ ] Live combat log streaming
- [ ] Advanced filtering (date range, encounter type)
- [ ] Custom report templates
- [ ] Export to PDF/Excel
- [ ] API endpoint for headless analysis
- [ ] Database integration for historical tracking
- [ ] Multi-bot analysis (raid performance)
- [ ] PvP-specific metrics and analysis

**ML Improvements:**
- [ ] Neural network for rotation optimization
- [ ] Reinforcement learning for decision-making
- [ ] Transfer learning from top-performing bots
- [ ] Automated A/B testing framework

**Visualization Enhancements:**
- [ ] 3D position heatmaps
- [ ] Sankey diagrams for damage flow
- [ ] Network graphs for CC chains
- [ ] Real-time streaming charts

---

## Support

**Documentation:**
- This guide
- Code comments in each analyzer
- Type definitions in TypeScript files

**Community:**
- GitHub Issues: Report bugs or request features
- Discord: Real-time help (if available)

**Contributing:**
- See CONTRIBUTING.md
- Submit pull requests with improvements
- Add new analyzer features
- Expand baseline database

---

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Authors:** TrinityCore MCP Development Team
