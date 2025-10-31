# GameTable (GT) Files Documentation

## Overview

GameTable files are **critical game calculation tables** used by TrinityCore to determine various gameplay mechanics. These tab-separated text files contain precise formulas and values that Blizzard uses for WoW game calculations.

## Location

```
M:\Wplayerbot\data\gt\
```

## File Format

- **Format**: Tab-separated values (TSV)
- **First Line**: Column headers
- **First Column**: Row ID / Level
- **Data Columns**: Float values for calculations
- **Encoding**: UTF-8 with CRLF line endings

### Example Structure (CombatRatings.txt):
```
Level	Dodge	Parry	Block	Hit - Melee	Crit - Melee	Haste - Melee	Mastery
1	3.350108357	3.350108357	1.51870853	1.670579383	3.1267678	2.948095354	3.1267678
2	3.350108357	3.350108357	1.51870853	1.670579383	3.1267678	2.948095354	3.1267678
...
```

## Available GameTables

### Character Progression

#### **xp.txt** - Experience Requirements
- **Purpose**: XP required to reach each level
- **Columns**: Total, PerKill, Junk, Stats, Divisor
- **Usage**: Determines leveling speed, XP rewards
- **Bot Usage**: Calculate when bots should level, quest selection

#### **BaseMp.txt** - Base Mana Per Class
- **Purpose**: Starting mana for each class at each level
- **Columns**: One per class (Warrior, Mage, Priest, etc.)
- **Usage**: Character stat initialization
- **Bot Usage**: Mana management, spell casting decisions

#### **HpPerSta.txt** - Health Per Stamina
- **Purpose**: How much health each point of stamina grants
- **Columns**: Health
- **Usage**: Calculate effective HP from gear
- **Bot Usage**: Survival calculations, gear evaluation

### Combat Ratings

#### **CombatRatings.txt** - Rating Conversion Factors
- **Purpose**: Convert rating values to percentage bonuses
- **Columns**:
  - **Hit**: Melee, Ranged, Spell
  - **Crit**: Melee, Ranged, Spell
  - **Haste**: Melee, Ranged, Spell
  - **Dodge**, **Parry**, **Block**
  - **Expertise**, **Mastery**
  - **Versatility**: Damage Done, Healing Done, Damage Taken
  - **Avoidance**, **Lifesteal**, **Speed**
- **Usage**: Calculate actual combat effectiveness from gear stats
- **Bot Usage**:
  - **DPS bots**: Prioritize crit/haste for damage
  - **Tank bots**: Value dodge/parry for survival
  - **Healer bots**: Optimize haste for cast speed

**Example Calculation:**
```typescript
// At level 60, crit rating = 3.28310619
// If bot has 100 crit rating:
const critPercent = 100 / 3.28310619; // = 30.46% crit chance
```

#### **CombatRatingsMultByILvl.txt** - Item Level Multipliers
- **Purpose**: How item level affects stat values
- **Columns**: ArmorMultiplier, WeaponMultiplier, TrinketMultiplier, JewelryMultiplier
- **Usage**: Scale stats based on item level
- **Bot Usage**: Compare gear upgrades accurately

### Spell System

#### **SpellScaling.txt** - Spell Power Scaling
- **Purpose**: How spells scale with level and spell power
- **Columns**:
  - Per class (Warrior, Mage, etc.)
  - Item, Consumable, Gem1, Gem2, Gem3
  - Health, DamageReplaceStat, DamageSecondary
- **Usage**: Calculate actual spell damage/healing
- **Bot Usage**:
  - Spell selection based on effectiveness
  - Gear evaluation for casters
  - Healing output calculations

#### **NPCManaCostScaler.txt** - NPC Mana Costs
- **Purpose**: Scale mana costs for NPC spell casters
- **Columns**: Scaler
- **Usage**: Prevent NPCs from running out of mana
- **Bot Usage**: When bots control NPCs (pets, summons)

### Item System

#### **ItemLevelByLevel.txt** - Expected Item Level
- **Purpose**: What item level players should have at each level
- **Columns**: ItemLevel
- **Usage**: Quest rewards, loot tables
- **Bot Usage**: Gear upgrade decisions

#### **ItemSocketCostPerLevel.txt** - Socket Costs
- **Purpose**: Cost to add gem sockets to items
- **Columns**: SocketCost
- **Usage**: Socket crafting costs
- **Bot Usage**: Evaluate if socketing is worth it

#### **StaminaMultByILvl.txt** - Stamina from Item Level
- **Purpose**: How much stamina items grant based on ilevel
- **Columns**: ArmorMultiplier, WeaponMultiplier, TrinketMultiplier, JewelryMultiplier
- **Usage**: Calculate item stats
- **Bot Usage**: Survivability calculations from gear

### Battle Pets

#### **BattlePetXP.txt** - Pet Experience
- **Purpose**: XP progression for battle pets
- **Columns**: Wins, Xp
- **Usage**: Pet leveling system
- **Bot Usage**: If bots use battle pets

#### **BattlePetTypeDamageMod.txt** - Type Effectiveness
- **Purpose**: Damage modifiers for pet types (like Pokemon)
- **Usage**: Battle pet combat
- **Bot Usage**: Pet battle strategy

### Artifact System (Legion)

#### **ArtifactKnowledgeMultiplier.txt** - Knowledge Bonus
- **Purpose**: Artifact Power gain multiplier
- **Columns**: Multiplier
- **Usage**: Legion artifact weapons
- **Bot Usage**: If using Legion content

#### **ArtifactLevelXP.txt** - Artifact Power
- **Purpose**: AP required for artifact weapon levels
- **Columns**: XP, XP2
- **Usage**: Legion artifact weapons
- **Bot Usage**: If using Legion content

### Profession System

#### **BaseProfessionRatings.txt** - Base Skill
- **Purpose**: Base profession skill values
- **Usage**: Profession calculations
- **Bot Usage**: Crafting bots

#### **ProfessionRatings.txt** - Skill Scaling
- **Purpose**: How profession skills scale
- **Usage**: Profession effectiveness
- **Bot Usage**: Crafting quality calculations

### Miscellaneous

#### **BarberShopCostBase.txt** - Appearance Change Costs
- **Purpose**: Cost to change character appearance
- **Columns**: Cost
- **Usage**: Barber shop services
- **Bot Usage**: Rarely used by bots

#### **HonorLevel.txt** - PvP Progression
- **Purpose**: Honor level requirements for PvP
- **Usage**: PvP reward system
- **Bot Usage**: PvP bots

#### **SandboxScaling.txt** - Scaling Mode
- **Purpose**: Scaling factors for sandbox/scaling mode
- **Usage**: Level scaling system
- **Bot Usage**: If using scaling modes

## How TrinityCore Loads GT Files

```cpp
// From GameTables.cpp
void LoadGameTables(std::string const& dataPath) {
    boost::filesystem::path gtPath(dataPath);
    gtPath /= "gt";  // Append /gt to data path

    // Load each table
    LoadGameTable(sCombatRatingsGameTable, gtPath / "CombatRatings.txt");
    LoadGameTable(sXpGameTable, gtPath / "xp.txt");
    LoadGameTable(sBaseMPGameTable, gtPath / "BaseMp.txt");
    // ... etc
}
```

## Accessing GT Data in Bot Code

### From C++ (TrinityCore)
```cpp
// Get crit rating for level 60
GtCombatRatingsEntry const* ratings = sCombatRatingsGameTable.GetRow(60);
float critRating = ratings->CritMelee;

// Get XP required for level 60
GtXpEntry const* xp = sXpGameTable.GetRow(60);
uint32 xpRequired = xp->Total;

// Get base mana for Mage at level 60
GtBaseMPEntry const* mana = sBaseMPGameTable.GetRow(60);
float baseMana = mana->Mage;
```

### From MCP Server (TypeScript)
```typescript
// Query combat rating
const result = await getCombatRating(60, "Crit - Melee");

// Get character stats
const stats = await queryGameTable("xp.txt", 60);

// Get all stats for a level
const characterStats = {
  xp: await getXPForLevel(60),
  hpPerStamina: await getHpPerSta(60),
  baseMana: await getBaseMana(60, "Mage")
};
```

## Practical Bot Applications

### Combat Decision Making
```typescript
// Tank bot evaluating gear
const level = bot.getLevel();
const dodgeRating = await getCombatRating(level, "Dodge");
const parryRating = await getCombatRating(level, "Parry");

// Calculate avoidance from gear
const gearDodge = equipment.dodgeRating / dodgeRating;
const gearParry = equipment.parryRating / parryRating;
const totalAvoidance = gearDodge + gearParry;
```

### Leveling Optimization
```typescript
// Calculate if quest XP is worth it
const currentLevel = bot.getLevel();
const xpToLevel = await getXPForLevel(currentLevel + 1);
const questXP = quest.getRewardXP();

if (questXP / xpToLevel > 0.05) { // Worth >5% of level
  bot.acceptQuest(quest);
}
```

### Gear Evaluation
```typescript
// Compare two items
const level = bot.getLevel();
const critValue = await getCombatRating(level, "Crit - Melee");
const hasteValue = await getCombatRating(level, "Haste - Melee");

const item1Score = (item1.crit / critValue) + (item1.haste / hasteValue);
const item2Score = (item2.crit / critValue) + (item2.haste / hasteValue);

if (item2Score > item1Score) {
  bot.equipItem(item2);
}
```

## Performance Considerations

- **Cache GT Data**: Load once at startup, don't re-read files
- **Row Indexing**: Rows are 1-indexed (row 0 is unused)
- **Float Precision**: Values use 6+ decimal places
- **Memory Efficient**: Total size ~1MB for all tables
- **Fast Access**: Simple array lookup by level

## Why GT Files Matter for Bots

1. **Accurate Calculations**: Use exact Blizzard formulas
2. **Proper Scaling**: Stats scale correctly with level
3. **Smart Decisions**: Bots can evaluate gear mathematically
4. **Efficient Code**: Pre-calculated tables vs runtime formulas
5. **Authentic Behavior**: Bots use same calculations as real game

## Summary

GameTable files are the **mathematical foundation** of World of Warcraft's game mechanics. They provide:

- ✅ **Combat effectiveness calculations** (ratings to percentages)
- ✅ **Character progression** (XP, stats, mana)
- ✅ **Item evaluation** (comparing gear upgrades)
- ✅ **Spell mechanics** (damage/healing scaling)
- ✅ **Level-appropriate values** (every level has specific values)

For PlayerBot AI, these tables enable **intelligent decision-making** based on actual game mathematics rather than guesswork.

## TrinityCore MCP Server Tools

The TrinityCore MCP Server now provides **4 GameTable-specific tools**:

1. **query-gametable** - Query any GT file
2. **list-gametables** - List all available tables
3. **get-combat-rating** - Get specific combat ratings
4. **get-character-stats** - Get level-based stats

These tools make GT data accessible to Claude Code for:
- Bot AI development
- Game mechanic understanding
- Mathematical formula verification
- Gear optimization algorithms
