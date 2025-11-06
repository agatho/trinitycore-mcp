# MCP Combat Log Analyzer Integration Guide

Quick guide for using the comprehensive combat log analyzer via the TrinityCore MCP server.

---

## 🚀 Available Tools

### 1. `analyze-bot-combat-log` (Basic)
Basic combat log analysis with DPS/HPS calculations and rotation issues.

**Usage:**
```typescript
{
  "tool": "analyze-bot-combat-log",
  "arguments": {
    "logFile": "/path/to/combat.log",
    "botName": "WarriorBot",
    "outputFormat": "markdown"
  }
}
```

### 2. `analyze-combat-log-comprehensive` (Advanced) ⭐
**NEW!** Enterprise-grade comprehensive analysis with ML-powered insights.

**Features:**
- ✅ Cooldown tracking with proc detection
- ✅ Decision tree analysis
- ✅ Combat mechanics evaluation (interrupts, CC, movement, resources)
- ✅ ML pattern detection and behavior classification
- ✅ Performance comparison vs baselines
- ✅ Comprehensive prioritized recommendations

**Usage:**
```typescript
{
  "tool": "analyze-combat-log-comprehensive",
  "arguments": {
    "logFile": "/path/to/combat.log",
    "botName": "WarriorBot",
    "className": "Warrior",
    "spec": "Arms",
    "level": 60,
    "includeML": true,
    "includeRecommendations": true,
    "outputFormat": "markdown"
  }
}
```

---

## 📊 Parameters

### Required
- `botName` (string): Name of the bot to analyze

### Optional
- `logFile` (string): Path to combat log file
- `logText` (string): Combat log text (alternative to logFile)
- `className` (string): Bot class (e.g., "Warrior", "Mage", "Priest")
  - Enables performance comparison vs class baselines
- `spec` (string): Bot specialization (e.g., "Arms", "Fire", "Holy")
  - Optional, improves performance comparison accuracy
- `level` (number): Bot level (default: 60)
- `includeML` (boolean): Include ML pattern detection (default: true)
- `includeRecommendations` (boolean): Include recommendations (default: true)
- `outputFormat` (string): Output format
  - `"markdown"` (default): Full formatted report
  - `"json"`: Structured JSON data
  - `"summary"`: Quick summary view

---

## 🎯 Output Formats

### Markdown (Default)
Full comprehensive report with all sections:
- Executive Summary
- Key Insights
- Decision Analysis
- Combat Mechanics
- ML Pattern Analysis
- Performance Comparison
- Recommendations

**Example:**
```markdown
# 🤖 Comprehensive Bot Combat Log Analysis

## 📊 Executive Summary
**Combat Duration:** 180.0s
**Total Events:** 1,250
**DPS:** 600
...
```

### JSON
Structured data for programmatic processing:
```json
{
  "basic": {
    "summary": { ... },
    "duration": 180,
    "events": 1250
  },
  "cooldowns": { ... },
  "decisions": { ... },
  "mechanics": { ... },
  "patterns": { ... },
  "performance": { ... },
  "recommendations": { ... }
}
```

### Summary
Quick overview with key metrics and top recommendations:
```markdown
# 🤖 Combat Log Analysis Summary

Duration: 180.0s | DPS: 600

**Scores:**
  • Decision Quality: 85/100
  • Combat Mechanics: 78/100
  • Skill Level: 82/100
  • Performance Grade: A

**🎯 Quick Wins:**
  • [HIGH] Use Recklessness More Frequently
  • [MEDIUM] Optimize Bloodthirst Usage
  • [MEDIUM] Improve Interrupt Accuracy
```

---

## 🔧 Integration Examples

### From Claude Code

1. **Basic Analysis:**
```
Use analyze-combat-log-comprehensive to analyze combat.log for bot WarriorBot
```

2. **With Class Comparison:**
```
Analyze combat.log for WarriorBot (Warrior/Arms/60) using comprehensive analysis
```

3. **JSON Output:**
```
Run comprehensive combat log analysis on WarriorBot and output as JSON
```

### From TypeScript/JavaScript

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Call MCP tool
const result = await server.callTool("analyze-combat-log-comprehensive", {
  logFile: "/var/logs/combat.log",
  botName: "WarriorBot",
  className: "Warrior",
  spec: "Arms",
  level: 60,
  outputFormat: "json"
});

const report = JSON.parse(result.content[0].text);
console.log(`DPS: ${report.basic.summary.dps}`);
console.log(`Performance Grade: ${report.performance.summary.overallRating.grade}`);
console.log(`Skill Level: ${report.patterns.skillLevel}/100`);
```

### From Python (via MCP Client)

```python
import json
from mcp import Client

client = Client("trinitycore-mcp")

# Analyze combat log
result = client.call_tool(
    "analyze-combat-log-comprehensive",
    {
        "logFile": "/var/logs/combat.log",
        "botName": "WarriorBot",
        "className": "Warrior",
        "spec": "Arms",
        "outputFormat": "json"
    }
)

report = json.loads(result["content"][0]["text"])
print(f"DPS: {report['basic']['summary']['dps']}")
print(f"Grade: {report['performance']['summary']['overallRating']['grade']}")

# Print top recommendations
for rec in report['recommendations']['roadmap']['quickWins']:
    print(f"[{rec['priority']}] {rec['title']}")
```

---

## 📈 Use Cases

### 1. Bot Performance Optimization
**Goal:** Identify and fix performance issues in bot AI

**Steps:**
1. Enable combat logging on TrinityCore server
2. Run bot through typical combat scenario
3. Extract combat log for specific bot
4. Run comprehensive analysis
5. Review recommendations
6. Implement fixes
7. Re-analyze to verify improvements

**Expected Improvements:**
- 10-30% DPS increase from cooldown optimization
- 15-25% improvement from decision quality fixes
- 5-15% gain from mechanics improvements

### 2. Behavioral Analysis
**Goal:** Understand and classify bot behavior patterns

**Steps:**
1. Analyze multiple combat sessions
2. Review ML pattern detection results
3. Identify behavior type (aggressive, defensive, balanced, etc.)
4. Check skill level score
5. Detect anomalies

**Insights:**
- Behavior classification (10 types)
- Aggression, caution, efficiency, reactivity scores
- Anomaly detection (performance spikes/drops)

### 3. A/B Testing Bot Configurations
**Goal:** Compare two bot configurations scientifically

**Steps:**
1. Run bot with Config A, collect combat log
2. Analyze with comprehensive tool
3. Run bot with Config B, collect combat log
4. Analyze with comprehensive tool
5. Compare:
   - DPS/HPS differences
   - Decision quality changes
   - Mechanics improvements
   - Overall performance grades

**Metrics to Compare:**
- Performance grades (S/A/B/C/D/F)
- Skill level scores (0-100)
- Decision quality (0-100)
- Mechanics score (0-100)

### 4. Class Balance Analysis
**Goal:** Ensure all bot classes perform at expected levels

**Steps:**
1. Collect combat logs for all classes
2. Run comprehensive analysis for each
3. Compare vs class baselines
4. Identify underperforming classes
5. Review recommendations per class

**Comparison Points:**
- DPS vs baseline percentage
- Percentile rankings
- Common issues per class
- Performance gaps

### 5. Continuous Integration Testing
**Goal:** Automated bot performance regression detection

**Steps:**
1. Add combat log analysis to CI pipeline
2. Run standardized test scenarios
3. Analyze with JSON output format
4. Parse results and check thresholds
5. Fail build if performance regresses

**Thresholds Example:**
```typescript
const report = JSON.parse(analysisResult);

// Fail if skill level drops below 70
if (report.patterns.skillLevel < 70) {
  throw new Error("Skill level regression detected");
}

// Fail if DPS drops by more than 10%
const baseline = await loadBaseline();
const dpsDrop = ((baseline.dps - report.basic.summary.dps) / baseline.dps) * 100;
if (dpsDrop > 10) {
  throw new Error(`DPS regression: ${dpsDrop.toFixed(1)}% drop`);
}
```

---

## 🐛 Troubleshooting

### Issue: "No combat log entries found"
**Cause:** Invalid log format or empty log
**Solution:**
1. Verify combat logging is enabled on server
2. Check log file actually contains data
3. Ensure log format matches TrinityCore standard
4. Try filtering log to specific bot first: `grep "BotName" combat.log > bot_combat.log`

### Issue: "Bot name not found in log"
**Cause:** Bot name doesn't match any events in log
**Solution:**
1. Check exact spelling (case-sensitive)
2. Verify bot participated in combat
3. Use `grep "BotName" combat.log` to verify presence
4. Check if bot name includes server suffix (e.g., "Bot-Server")

### Issue: "Performance comparison not available"
**Cause:** className not provided
**Solution:**
1. Add `className` parameter
2. Optionally add `spec` for better accuracy
3. Check supported classes: Warrior, Mage, Rogue, Priest, etc.

### Issue: "ML analysis failed"
**Cause:** Insufficient data or error in ML pipeline
**Solution:**
1. Ensure combat log has enough events (>100)
2. Set `includeML: false` to skip ML analysis
3. Check console for specific ML error messages
4. Report issue if persistent

### Issue: "Recommendations not generated"
**Cause:** Missing required analyses
**Solution:**
1. Ensure both ML and performance comparison are enabled
2. Provide className for performance comparison
3. Set `includeRecommendations: true` explicitly
4. Check that all prerequisite analyses completed successfully

---

## 📚 Additional Resources

- **Full User Guide:** [BOT_COMBAT_LOG_ANALYZER_GUIDE.md](./BOT_COMBAT_LOG_ANALYZER_GUIDE.md)
- **Web UI Dashboard:** `web-ui/app/combat-log-analyzer/page.tsx`
- **Source Code:**
  - Main tool: `src/tools/combatloganalyzer-advanced.ts`
  - Cooldown tracker: `src/tools/cooldown-tracker.ts`
  - Decision analyzer: `src/tools/decision-tree-analyzer.ts`
  - Combat mechanics: `src/tools/combat-mechanics-analyzer.ts`
  - ML patterns: `src/tools/pattern-detection-ml.ts`
  - Performance comparison: `src/tools/performance-comparison.ts`
  - Recommendations: `src/tools/recommendation-engine.ts`

---

## 🎓 Best Practices

1. **Always provide className** for the most comprehensive analysis
2. **Use markdown format** for human review, JSON for automation
3. **Start with summary format** for quick checks, full markdown for deep dives
4. **Filter logs** to specific bots/encounters for faster analysis
5. **Track improvements** by re-analyzing after implementing recommendations
6. **Compare sessions** using historical data for trend analysis
7. **Focus on quick wins** first - easy implementation, high impact
8. **Iterate** - implement, test, analyze, repeat

---

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Part of:** TrinityCore MCP Server v1.3.0+
