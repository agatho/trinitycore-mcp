# TrinityCore MCP Server - Testing Guide

## 🎯 What is This Server?

The TrinityCore MCP Server is a **Model Context Protocol (MCP) server**, NOT a web application. It provides **56 specialized tools** that AI assistants (like Claude) can use to help with TrinityCore bot development.

**Think of it as**: An AI-accessible API that provides TrinityCore data and calculations.

---

## 🧪 Testing Methods

### **Method 1: Automated Test Suite (Recommended)**

Run the comprehensive Phase 7 test suite that validates all enhancements:

```bash
cd /c/TrinityBots/trinitycore-mcp

# Build the project
npm run build

# Run Phase 7 enhancement tests
node test_phase7_enhancements.js
```

**Expected Output:**
```
==========================================================
🧪 PHASE 7 ENHANCEMENT TESTING
==========================================================

✅ Tests Passed:    15 (100.0%)
❌ Tests Failed:    0 (0.0%)
Build Status:       ✅ ALL TESTS PASSING
```

**What This Tests:**
- ✅ Stat Priorities Database (39 WoW specs)
- ✅ SpellRange Database (68 spell ranges)
- ✅ Quest XP Calculations (level 1-80)
- ✅ Reputation Gain Calculations (racial/guild/event bonuses)
- ✅ Spell Attribute Parsing (511 flags)
- ✅ Quest Color System (gray/green/yellow/orange/red)

---

### **Method 2: Interactive Node.js Testing**

Test individual MCP tools directly via Node.js:

#### **Test 1: Stat Priorities (Enhancement #3)**
```bash
node -e "import('./dist/data/stat-priorities.js').then(m => {
  const frostMage = m.getStatPriority(8, 64, 'raid_dps');
  console.log('Frost Mage Stat Priority:', frostMage.priorityOrder.slice(0, 3).join(' > '));
  console.log('Haste weight:', frostMage.weights.haste);
})"
```

**Expected Output:**
```
Frost Mage Stat Priority: intellect > haste > criticalStrike
Haste weight: 0.88
```

#### **Test 2: Spell Ranges (Enhancement #5)**
```bash
node -e "import('./dist/data/spell-ranges.js').then(m => {
  const melee = m.getSpellRange(1);
  const standard = m.getSpellRange(4);
  console.log('Melee range:', melee.minRangeHostile + '-' + melee.maxRangeHostile + ' yards');
  console.log('Standard range:', standard.maxRangeHostile + ' yards');
})"
```

**Expected Output:**
```
Melee range: 0-5 yards
Standard range: 40 yards
```

#### **Test 3: Quest XP Calculations (Enhancement #6)**
```bash
node -e "import('./dist/data/xp-per-level.js').then(m => {
  const xp = m.getXPToNextLevel(25);
  const color = m.getQuestColor(27, 25);
  const finalXP = m.calculateQuestXPWithModifiers(5000, 27, 25, true);
  console.log('Level 25→26 XP:', xp);
  console.log('Level 27 quest for level 25:', color);
  console.log('5000 base XP with rest bonus:', finalXP, 'XP');
})"
```

**Expected Output:**
```
Level 25→26 XP: 1800
Level 27 quest for level 25: yellow
5000 base XP with rest bonus: 7500 XP
```

#### **Test 4: Reputation Calculations (Enhancement #7)**
```bash
node -e "import('./dist/tools/reputation.js').then(m => {
  const result = m.calculateReputationGain(100, 1, true, 6, ['Darkmoon Faire']);
  console.log('Base: 100 → Final:', result.finalReputation);
  console.log('Multiplier:', result.totalMultiplier + 'x (+' + ((result.totalMultiplier - 1) * 100).toFixed(1) + '%)');
  console.log('Applied:', result.multipliers.map(mult => mult.name).join(', '));
})"
```

**Expected Output:**
```
Base: 100 → Final: 133
Multiplier: 1.331x (+33.1%)
Applied: Diplomacy, Mr. Popularity (Rank 2), Darkmoon Faire - WHEE!
```

#### **Test 5: Spell Attributes (Enhancement #2)**
```bash
node -e "import('./dist/data/spell-attributes.js').then(m => {
  const flags = m.parseAttributeBitfield(0, 0x00000001);
  console.log('Parsed flag:', flags[0].name);
  console.log('Category:', flags[0].category);
})"
```

**Expected Output:**
```
Parsed flag: PROC_FAILURE_BURNS_CHARGE
Category: proc
```

---

### **Method 3: Use with Claude Desktop (Production)**

This is the **intended use case** for the MCP server:

#### **Step 1: Configure Claude Desktop**

Create or edit `~/.claude/mcp-servers-config.json`:

```json
{
  "trinitycore": {
    "command": "node",
    "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_PORT": "3306",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "your_password",
      "TRINITY_ROOT": "C:\\TrinityBots\\TrinityCore",
      "DBC_PATH": "C:\\TrinityBots\\Server\\data\\dbc",
      "DB2_PATH": "C:\\TrinityBots\\Server\\data\\db2"
    }
  }
}
```

#### **Step 2: Restart Claude Desktop**

After adding the configuration, restart Claude Desktop to load the MCP server.

#### **Step 3: Test MCP Tools**

Ask Claude to use the TrinityCore MCP tools:

**Example Queries:**
- "What are the stat priorities for Frost Mage in raids?"
- "What's the spell range for ID 4?"
- "Calculate quest XP for a level 25 player doing a level 27 quest with rest bonus"
- "Calculate reputation gain for a Human with guild perks during Darkmoon Faire"
- "Parse spell attributes for bitfield 0x00000001"

Claude will automatically call the MCP tools to answer these questions.

---

### **Method 4: Database Connection Test**

Verify database connectivity (requires TrinityCore database):

```bash
node -e "import('./dist/database/connection.js').then(m => {
  m.queryWorld('SELECT COUNT(*) as count FROM spell_template').then(result => {
    console.log('Database connection: SUCCESS');
    console.log('Spell count:', result[0].count);
  }).catch(err => {
    console.error('Database connection: FAILED');
    console.error('Error:', err.message);
  });
})"
```

**Expected Output (if DB connected):**
```
Database connection: SUCCESS
Spell count: 45000
```

**Expected Output (if DB not connected):**
```
Database connection: FAILED
Error: connect ECONNREFUSED
```

---

## 📊 What Each Testing Method Validates

| Method | What It Tests | Speed | Coverage |
|--------|---------------|-------|----------|
| **Automated Test Suite** | All Phase 7 enhancements (15 tests) | ~5 sec | 100% Phase 7 |
| **Interactive Node.js** | Individual tool functionality | ~1 sec each | Specific tools |
| **Claude Desktop** | Production MCP integration | Real-time | All 56 tools |
| **Database Test** | Database connectivity | ~2 sec | DB layer only |

---

## 🎯 Current Test Status

**Phase 7 Enhancements:**
- ✅ Enhancement #1: Quest Reward Best Choice Logic
- ✅ Enhancement #2: Spell Attribute Flag Parsing (511 flags)
- ✅ Enhancement #3: Stat Priorities Database (39 specs)
- ✅ Enhancement #5: SpellRange Database (68 ranges)
- ✅ Enhancement #6: Quest XP Calculations
- ✅ Enhancement #7: Reputation Gain Calculations

**Test Results:**
```
Total Tests:     15
Passed:          15 (100.0%)
Failed:          0 (0.0%)
Build Status:    ✅ PASSING
```

---

## 🚀 Quick Start Testing

**1-Minute Test:**
```bash
cd /c/TrinityBots/trinitycore-mcp
npm run build && node test_phase7_enhancements.js
```

**If you see:**
```
✅ Tests Passed:    15 (100.0%)
Build Status:       ✅ ALL TESTS PASSING
```

**Then the server is working perfectly!** 🎉

---

## ❓ FAQ

### Q: Is there a web interface to test this?
**A:** No. This is an MCP server designed to be used by AI assistants, not humans directly. It has no HTTP endpoints or web UI.

### Q: How do I see the tools in action?
**A:** Either:
1. Run the automated test suite (`node test_phase7_enhancements.js`)
2. Use interactive Node.js tests (see Method 2 above)
3. Configure with Claude Desktop and ask Claude to use the tools

### Q: Can I test without a TrinityCore database?
**A:** Yes! Phase 7 enhancements work **without a database**:
- Stat Priorities (in-memory data)
- Spell Ranges (in-memory data)
- Quest XP (in-memory data)
- Reputation Calculations (in-memory data)
- Spell Attributes (in-memory data)

Only database-dependent tools (like `get-spell-info`, `get-item-info`) require DB access.

### Q: What if tests fail?
**A:** If any test fails:
1. Run `npm run build` first
2. Check the error message
3. Verify TypeScript compilation succeeded
4. Report the issue with the exact error message

---

## 📝 Summary

**Best Testing Approach:**
1. **Quick validation**: Run `node test_phase7_enhancements.js` (5 seconds)
2. **Deep testing**: Try interactive Node.js tests for specific tools
3. **Production use**: Configure with Claude Desktop

**No web interface needed** - this server is designed for AI-to-AI communication via the Model Context Protocol!
