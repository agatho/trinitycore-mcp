# TrinityCore MCP Server - Usage Examples & Tutorials

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Current Version:** v1.3.0

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage Examples](#basic-usage-examples)
3. [Advanced Tutorials](#advanced-tutorials)
4. [Integration Patterns](#integration-patterns)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥18.0.0
- MySQL 8.0+ or MariaDB 10.3+
- TrinityCore server installation
- Claude Code or MCP-compatible AI assistant

### Installation
```bash
# Clone the repository
git clone https://github.com/agatho/trinitycore-mcp.git
cd trinitycore-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Configure environment
cp .env.template .env
# Edit .env with your database credentials
```

### Configuration
```env
# .env file
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password
TRINITY_ROOT=C:\TrinityBots\TrinityCore
DBC_PATH=C:\TrinityBots\Server\data\dbc
DB2_PATH=C:\TrinityBots\Server\data\db2
MCP_PORT=3000
```

### Starting the Server
```bash
# Start MCP server
npm start

# Server will be available at localhost:3000
# Configure Claude Code to connect to this server
```

---

## 📖 Basic Usage Examples

### Example 1: Query Spell Information

**Use Case**: Get detailed information about a spell for bot AI decision-making

```typescript
// Tool: get-spell-info
// Query Fireball spell (ID: 133)

const spellInfo = await tools.getSpellInfo({
  spellId: 133
});

console.log(spellInfo);
// Output:
// {
//   spellId: 133,
//   name: 'Fireball',
//   schoolMask: 4,  // Fire school
//   castTime: 3500,  // 3.5 seconds
//   range: { min: 0, max: 40 },
//   effects: [
//     {
//       type: 'SPELL_EFFECT_SCHOOL_DAMAGE',
//       basePoints: 800,
//       ...
//     }
//   ]
// }
```

**Bot AI Integration:**
```typescript
// Use in bot combat rotation
function shouldCastFireball(bot: Bot, target: Unit): boolean {
  const spell = await getSpellInfo({ spellId: 133 });

  // Check if in range
  const distance = bot.getDistanceTo(target);
  if (distance > spell.range.max) return false;

  // Check if can afford cast time
  if (bot.isMoving() && spell.castTime > 0) return false;

  // Check mana cost
  if (bot.getPower(POWER_MANA) < spell.manaCost) return false;

  return true;
}
```

---

### Example 2: Optimize Gear for Bot

**Use Case**: Find best-in-slot gear for a Fury Warrior bot

```typescript
// Tool: optimize-gear-set
// Optimize for raid DPS

const gearSet = await tools.optimizeGearSet({
  classId: 1,        // Warrior
  specId: 72,        // Fury
  role: 'dps',
  contentType: 'raid',
  currentItemLevel: 450,
  targetItemLevel: 480
});

console.log(gearSet);
// Output:
// {
//   recommendations: [
//     {
//       slot: 'head',
//       currentItem: { id: 12345, ilvl: 450 },
//       recommendedItem: { id: 67890, ilvl: 480 },
//       expectedGain: 5.2  // 5.2% DPS increase
//     },
//     ...
//   ],
//   totalExpectedGain: 18.7,  // 18.7% total DPS increase
//   priorityOrder: ['weapon', 'trinket', 'head', ...]
// }
```

**Bot Integration:**
```typescript
// Auto-equip upgrades
async function autoEquipUpgrades(bot: Bot) {
  const gearSet = await optimizeGearSet({
    classId: bot.getClass(),
    specId: bot.getSpecialization(),
    role: bot.getRole(),
    contentType: 'mythic_plus',
    currentItemLevel: bot.getAverageItemLevel(),
    targetItemLevel: bot.getAverageItemLevel() + 10
  });

  for (const rec of gearSet.recommendations) {
    if (rec.expectedGain > 3.0) {  // Only equip if >3% gain
      const item = bot.getItemInBag(rec.recommendedItem.id);
      if (item) {
        bot.equipItem(item, rec.slot);
        console.log(`Equipped ${rec.recommendedItem.name} for +${rec.expectedGain}% DPS`);
      }
    }
  }
}
```

---

### Example 3: Plan Quest Route

**Use Case**: Optimize leveling route for a bot in Westfall

```typescript
// Tool: optimize-quest-route
// Optimize quests in Westfall for level 15 character

const questRoute = await tools.optimizeQuestRoute({
  zoneId: 40,          // Westfall
  playerLevel: 15,
  maxQuests: 20,
  currentLocation: { x: -10645, y: 1046, z: 32 }
});

console.log(questRoute);
// Output:
// {
//   optimizedOrder: [
//     { questId: 151, pickupNPC: 823, turnin: 823 },
//     { questId: 152, pickupNPC: 823, turnin: 234 },
//     ...
//   ],
//   estimatedTime: 45,      // 45 minutes
//   totalXP: 28500,
//   xpPerHour: 38000,
//   efficiency: 0.92        // 92% efficiency
// }
```

**Bot Integration:**
```typescript
// Auto-quest leveling
async function levelInZone(bot: Bot, zoneId: number) {
  const route = await optimizeQuestRoute({
    zoneId,
    playerLevel: bot.getLevel(),
    maxQuests: 30,
    currentLocation: bot.getPosition()
  });

  for (const step of route.optimizedOrder) {
    // Pick up quest
    await bot.goToNPC(step.pickupNPC);
    await bot.acceptQuest(step.questId);

    // Complete objectives
    await bot.completeQuestObjectives(step.questId);

    // Turn in quest
    await bot.goToNPC(step.turnin);
    await bot.turnInQuest(step.questId);

    console.log(`Completed quest ${step.questId} (+${step.xpReward} XP)`);
  }
}
```

---

## 🎓 Advanced Tutorials

### Tutorial 1: Building a Smart Combat AI

**Goal**: Create an intelligent combat rotation system that adapts based on situation

```typescript
// Step 1: Get class-specific stat weights
const statWeights = getDefaultStatWeights(
  bot.getClass(),
  bot.getSpecialization(),
  ContentType.RAID_DPS
);

// Step 2: Get recommended talent build
const talents = await getTalentBuild({
  specId: bot.getSpecialization(),
  purpose: 'raid',
  playerLevel: bot.getLevel()
});

// Step 3: Build dynamic rotation based on resources
class SmartCombatAI {
  private bot: Bot;
  private rotation: Spell[];

  constructor(bot: Bot) {
    this.bot = bot;
    this.rotation = this.buildRotation();
  }

  private async buildRotation(): Promise<Spell[]> {
    // Get all spells for class
    const classSpells = await this.getClassSpells();

    // Sort by priority based on:
    // 1. Cooldown availability
    // 2. Resource cost efficiency
    // 3. Situational bonuses (AoE, single-target, etc.)
    return classSpells.sort((a, b) => {
      const scoreA = this.calculateSpellScore(a);
      const scoreB = this.calculateSpellScore(b);
      return scoreB - scoreA;
    });
  }

  private calculateSpellScore(spell: Spell): number {
    let score = 0;

    // DPS contribution
    score += spell.damage / spell.castTime;

    // Resource efficiency
    score += (spell.damage / spell.cost) * 0.5;

    // Cooldown value (burst vs sustained)
    if (spell.cooldown > 60) score += 10;  // Major cooldown

    // Situational bonuses
    if (this.isAoESituation() && spell.isAoE) score += 5;
    if (this.isBurstPhase() && spell.isBurst) score += 8;

    return score;
  }

  public async executeRotation(target: Unit) {
    for (const spell of this.rotation) {
      if (this.canCast(spell, target)) {
        await this.bot.castSpell(spell.id, target);
        break;
      }
    }
  }

  private canCast(spell: Spell, target: Unit): boolean {
    // Range check
    if (this.bot.getDistanceTo(target) > spell.range.max) return false;

    // Resource check
    if (this.bot.getPower() < spell.cost) return false;

    // Cooldown check
    if (this.bot.isOnCooldown(spell.id)) return false;

    // GCD check
    if (this.bot.isOnGlobalCooldown()) return false;

    return true;
  }
}

// Usage
const combatAI = new SmartCombatAI(myBot);
combatAI.executeRotation(currentTarget);
```

---

### Tutorial 2: Multi-Bot Raid Coordination

**Goal**: Coordinate cooldowns and positioning for 10-man raid

```typescript
// Step 1: Analyze group composition
const groupAnalysis = await analyzeGroupComposition({
  bots: raidBots.map(bot => ({
    botId: bot.getId(),
    name: bot.getName(),
    classId: bot.getClass(),
    className: bot.getClassName(),
    specId: bot.getSpec(),
    role: bot.getRole(),
    level: bot.getLevel(),
    itemLevel: bot.getItemLevel()
  }))
});

console.log(groupAnalysis);
// Output:
// {
//   balance: {
//     tanks: 2, healers: 3, dps: 5,
//     melee: 2, ranged: 3
//   },
//   strengths: ['High single-target DPS', 'Strong defensive cooldowns'],
//   weaknesses: ['Low AoE damage', 'Limited crowd control'],
//   recommendations: [...]
// }

// Step 2: Coordinate raid cooldowns
const cooldownPlan = await coordinateCooldowns({
  bots: raidBots.map(bot => ({...})),
  encounterDuration: 300  // 5-minute fight
});

console.log(cooldownPlan);
// Output:
// {
//   timeline: [
//     { time: 0, bot: 'MainTank', cooldown: 'Shield Wall' },
//     { time: 30, bot: 'Healer1', cooldown: 'Divine Hymn' },
//     { time: 60, bot: 'DPS1', cooldown: 'Bloodlust' },
//     ...
//   ],
//   coverage: {
//     defensive: [{ start: 0, end: 10 }, { start: 90, end: 100 }],
//     offensive: [{ start: 60, end: 100 }]
//   }
// }

// Step 3: Execute coordinated strategy
class RaidCoordinator {
  private bots: Bot[];
  private cooldownPlan: CooldownPlan;

  constructor(bots: Bot[], plan: CooldownPlan) {
    this.bots = bots;
    this.cooldownPlan = plan;
  }

  public async executeFight() {
    const startTime = Date.now();

    // Start encounter
    this.bots[0].attackTarget(boss);

    // Monitor cooldown timeline
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      // Check for scheduled cooldowns
      const scheduledCDs = this.cooldownPlan.timeline
        .filter(cd => Math.abs(cd.time - elapsed) < 1);

      for (const cd of scheduledCDs) {
        const bot = this.bots.find(b => b.getName() === cd.bot);
        if (bot) {
          bot.useCooldown(cd.cooldown);
          console.log(`[${elapsed}s] ${cd.bot} used ${cd.cooldown}`);
        }
      }
    }, 1000);

    // Monitor boss health
    while (boss.isAlive() && this.bots.some(b => b.isAlive())) {
      await this.sleep(100);

      // Adapt strategy based on boss phase
      if (boss.getHealthPct() < 30) {
        this.executeExecutePhase();
      }
    }

    clearInterval(interval);
  }

  private executeExecutePhase() {
    // Use remaining cooldowns for burn phase
    for (const bot of this.bots.filter(b => b.getRole() === 'dps')) {
      bot.useAllCooldowns();
    }
  }
}

// Usage
const coordinator = new RaidCoordinator(raidBots, cooldownPlan);
await coordinator.executeFight();
```

---

### Tutorial 3: Automated Economy Bot

**Goal**: Create a bot that monitors AH and flips items for profit

```typescript
class EconomyBot {
  private profitThreshold = 0.20;  // 20% profit minimum

  public async scanAuctionHouse() {
    // Step 1: Get trending items
    const trendingItems = await this.getTrendingItems();

    for (const itemId of trendingItems) {
      // Step 2: Analyze item pricing
      const analysis = await analyzeAuctionItem({
        itemId,
        realm: 'Area-52'
      });

      console.log(analysis);
      // Output:
      // {
      //   itemId: 172230,
      //   name: 'Soul Dust',
      //   currentPrice: 500,  // 5g
      //   marketValue: 650,   // 6g 50s
      //   trend: 'rising',
      //   volatility: 0.15,
      //   recommendation: 'buy'
      // }

      // Step 3: Make buy/sell decisions
      if (analysis.recommendation === 'buy') {
        const profit = analysis.marketValue - analysis.currentPrice;
        const profitPct = profit / analysis.currentPrice;

        if (profitPct > this.profitThreshold) {
          await this.buyItem(itemId, analysis.currentPrice, 20);
          console.log(`Bought 20x ${analysis.name} @ ${analysis.currentPrice}c`);
          console.log(`Expected profit: ${profit * 20}c (${(profitPct * 100).toFixed(1)}%)`);
        }
      } else if (analysis.recommendation === 'sell') {
        await this.sellItem(itemId, analysis.marketValue);
      }
    }
  }

  private async getTrendingItems(): Promise<number[]> {
    // Query for items with high trade volume
    const query = `
      SELECT item_id, COUNT(*) as trades
      FROM auction_history
      WHERE timestamp > NOW() - INTERVAL 7 DAY
      GROUP BY item_id
      ORDER BY trades DESC
      LIMIT 50
    `;
    return await this.db.query(query);
  }

  private async buyItem(itemId: number, maxPrice: number, quantity: number) {
    // Find auctions below max price
    const auctions = await this.findAuctions(itemId, maxPrice);

    for (const auction of auctions.slice(0, quantity)) {
      await this.bot.buyAuction(auction.id);
    }
  }

  private async sellItem(itemId: number, price: number) {
    // Post items at market value
    const items = this.bot.getItemsInBag(itemId);
    for (const item of items) {
      await this.bot.postAuction(item, price, 24 * 60 * 60);  // 24 hours
    }
  }
}

// Usage
const economyBot = new EconomyBot();
setInterval(() => economyBot.scanAuctionHouse(), 5 * 60 * 1000);  // Every 5 minutes
```

---

## 🔌 Integration Patterns

### Pattern 1: Claude Code Integration

**Configure Claude Code MCP:**
```json
// .claude/mcp-servers-config.json
{
  "trinitycore": {
    "command": "node",
    "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}"
    }
  }
}
```

**Use in Claude Code:**
```
User: "Get the stat weights for a Frost Mage doing M+ content"

Claude Code: *Uses trinitycore__get-default-stat-weights tool*
{
  "classId": 8,
  "specId": 64,
  "contentType": "mythic_plus"
}

Response:
For Frost Mage (spec 64) in Mythic+ content:
- Intellect: 1.0 (primary stat)
- Critical Strike: 0.90
- Haste: 0.78
- Mastery: 0.80
- Versatility: 0.72
```

### Pattern 2: Direct API Usage

**TypeScript Integration:**
```typescript
import {
  getSpellInfo,
  getTalentBuild,
  optimizeGearSet
} from 'trinitycore-mcp';

// Use in your bot AI
async function initializeBotAI(bot: Bot) {
  // Get talents
  const talents = await getTalentBuild({
    specId: bot.getSpec(),
    purpose: 'mythic_plus',
    playerLevel: bot.getLevel()
  });

  // Apply talents
  bot.setTalents(talents.talents);

  // Get gear recommendations
  const gear = await optimizeGearSet({
    classId: bot.getClass(),
    specId: bot.getSpec(),
    role: bot.getRole(),
    contentType: 'mythic_plus',
    currentItemLevel: bot.getItemLevel(),
    targetItemLevel: bot.getItemLevel() + 15
  });

  // Auto-equip upgrades
  for (const rec of gear.recommendations) {
    if (bot.hasItem(rec.recommendedItem.id)) {
      bot.equipItem(rec.recommendedItem.id, rec.slot);
    }
  }
}
```

---

## ✅ Best Practices

### Performance Optimization

1. **Use Caching**
```typescript
const cache = new Map<string, any>();

async function getSpellInfoCached(spellId: number) {
  const cacheKey = `spell_${spellId}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const data = await getSpellInfo({ spellId });
  cache.set(cacheKey, data);
  return data;
}
```

2. **Batch Requests**
```typescript
// Instead of multiple single requests
for (const itemId of itemIds) {
  await getItemInfo({ itemId });  // SLOW
}

// Use batch query
const items = await Promise.all(
  itemIds.map(id => getItemInfo({ itemId: id }))
);  // FAST
```

3. **Lazy Loading**
```typescript
class BotAI {
  private spellData: Map<number, Spell> = new Map();

  async getSpellData(spellId: number) {
    if (!this.spellData.has(spellId)) {
      const data = await getSpellInfo({ spellId });
      this.spellData.set(spellId, data);
    }
    return this.spellData.get(spellId);
  }
}
```

### Error Handling

```typescript
async function safeGetSpellInfo(spellId: number) {
  try {
    return await getSpellInfo({ spellId });
  } catch (error) {
    console.error(`Failed to get spell ${spellId}:`, error);
    // Fallback to cached data or default values
    return getDefaultSpellData(spellId);
  }
}
```

### Resource Management

```typescript
class ResourceManager {
  private maxConcurrent = 10;
  private queue: Promise<any>[] = [];

  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    while (this.queue.length >= this.maxConcurrent) {
      await Promise.race(this.queue);
    }

    const promise = fn();
    this.queue.push(promise);

    promise.finally(() => {
      const index = this.queue.indexOf(promise);
      if (index > -1) this.queue.splice(index, 1);
    });

    return promise;
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: "Database connection failed"
**Solution:**
```bash
# Check database is running
mysql -u trinity -p -h localhost

# Verify credentials in .env
TRINITY_DB_HOST=localhost
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=correct_password

# Test connection
npm run test:db
```

#### Issue 2: "Tool not responding"
**Solution:**
```bash
# Check MCP server is running
curl http://localhost:3000/health

# Restart server
npm restart

# Check logs
tail -f logs/mcp-server.log
```

#### Issue 3: "Inaccurate recommendations"
**Solution:**
```typescript
// Ensure you're using correct content type
const weights = getDefaultStatWeights(
  classId,
  specId,
  ContentType.MYTHIC_PLUS  // Not RAID_DPS
);

// Verify talent build purpose
const talents = await getTalentBuild({
  specId,
  purpose: 'mythic_plus',  // Match your content
  playerLevel: 80
});
```

---

## 📚 Additional Resources

- **API Reference**: [data/api_docs/general/](../data/api_docs/general/)
- **Roadmap**: [ROADMAP_PHASE_3_4.md](ROADMAP_PHASE_3_4.md)
- **Testing Guide**: [TESTING_VALIDATION_PLAN.md](TESTING_VALIDATION_PLAN.md)
- **GitHub Issues**: https://github.com/agatho/trinitycore-mcp/issues
- **Release Notes**: https://github.com/agatho/trinitycore-mcp/releases

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Status**: ✅ Complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)
