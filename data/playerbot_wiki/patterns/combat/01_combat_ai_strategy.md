# Combat AI Strategy Pattern

**Tags**: [pattern, combat, ai, strategy, decision-making]
**Difficulty**: intermediate
**Category**: patterns

## Overview

The Combat AI Strategy pattern provides a framework for implementing intelligent combat decision-making for player bots. This pattern ensures thread-safe, performant, and maintainable combat AI across all bot classes and specializations.

## Pattern Structure

### Class Hierarchy

```cpp
// Base strategy interface
class CombatStrategy {
public:
    virtual ~CombatStrategy() = default;
    virtual void Update(BotAI* ai, uint32 diff) = 0;
    virtual bool ShouldEngage(Unit* target) const = 0;
    virtual float GetEngagementRange() const = 0;
};

// Role-specific strategies
class DPSCombatStrategy : public CombatStrategy { };
class TankCombatStrategy : public CombatStrategy { };
class HealerCombatStrategy : public CombatStrategy { };

// Class-specific implementations
class WarriorDPSStrategy : public DPSCombatStrategy { };
class PaladinTankStrategy : public TankCombatStrategy { };
class PriestHealerStrategy : public HealerCombatStrategy { };
```

## Implementation Steps

### Step 1: Define Strategy Interface

```cpp
// src/modules/Playerbot/AI/Strategies/CombatStrategy.h
#pragma once

#include "AI/BotAI.h"
#include "Entities/Unit/Unit.h"

class CombatStrategy {
public:
    virtual ~CombatStrategy() = default;

    // Core decision-making
    virtual void Update(BotAI* ai, uint32 diff) = 0;
    virtual bool ShouldEngage(Unit* target) const = 0;
    virtual float GetEngagementRange() const = 0;

    // Target selection
    virtual Unit* SelectTarget(BotAI* ai) const = 0;
    virtual bool IsValidTarget(Unit* target) const;

    // Ability prioritization
    virtual uint32 GetNextAbility(BotAI* ai) const = 0;
    virtual bool ShouldUseDefensiveCooldown(BotAI* ai) const = 0;

protected:
    // Helper methods
    bool HasEnoughMana(Player* bot, uint32 spellId) const;
    bool IsSpellReady(Player* bot, uint32 spellId) const;
    float CalculateThreat(Unit* target) const;
};
```

### Step 2: Implement DPS Strategy

```cpp
// src/modules/Playerbot/AI/Strategies/DPSCombatStrategy.cpp
#include "DPSCombatStrategy.h"
#include "Packets/SpellPacketBuilder.h"

void DPSCombatStrategy::Update(BotAI* ai, uint32 diff) {
    Player* bot = ai->GetBot();
    if (!bot || !bot->IsInCombat())
        return;

    Unit* target = ai->GetCurrentTarget();
    if (!target || !IsValidTarget(target)) {
        target = SelectTarget(ai);
        if (target)
            ai->SetCurrentTarget(target);
    }

    if (!target)
        return;

    // Execute combat rotation
    uint32 abilityId = GetNextAbility(ai);
    if (abilityId && IsSpellReady(bot, abilityId)) {
        SpellPacketBuilder builder;
        builder.CastSpell(bot, abilityId, target);
    }

    // Check for defensive cooldowns
    if (ShouldUseDefensiveCooldown(ai)) {
        UseDefensiveCooldown(ai);
    }
}

bool DPSCombatStrategy::ShouldEngage(Unit* target) const {
    if (!target || target->IsDead())
        return false;

    // DPS engages if target is attackable and in range
    return target->IsHostileTo(ai->GetBot()) &&
           target->IsWithinDistInMap(ai->GetBot(), GetEngagementRange());
}

float DPSCombatStrategy::GetEngagementRange() const {
    return 30.0f; // Standard DPS engagement range
}

Unit* DPSCombatStrategy::SelectTarget(BotAI* ai) const {
    Player* bot = ai->GetBot();

    // Prioritize current target
    if (Unit* current = ai->GetCurrentTarget())
        if (IsValidTarget(current))
            return current;

    // Find nearest hostile target
    Unit* nearestTarget = nullptr;
    float nearestDist = 999999.0f;

    std::list<Unit*> targets;
    Trinity::AnyUnfriendlyUnitInObjectRangeCheck check(bot, 30.0f);
    Trinity::UnitListSearcher<Trinity::AnyUnfriendlyUnitInObjectRangeCheck> searcher(bot, targets, check);
    Cell::VisitAllObjects(bot, searcher, 30.0f);

    for (Unit* target : targets) {
        if (!IsValidTarget(target))
            continue;

        float dist = bot->GetDistance(target);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = target;
        }
    }

    return nearestTarget;
}
```

### Step 3: Implement Class-Specific Strategy

```cpp
// src/modules/Playerbot/AI/Strategies/WarriorDPSStrategy.cpp
#include "WarriorDPSStrategy.h"

uint32 WarriorDPSStrategy::GetNextAbility(BotAI* ai) const {
    Player* bot = ai->GetBot();
    Unit* target = ai->GetCurrentTarget();

    if (!bot || !target)
        return 0;

    // Priority rotation for Arms Warrior
    // 1. Execute if target < 20% health
    if (target->HealthBelowPct(20) && IsSpellReady(bot, SPELL_EXECUTE))
        return SPELL_EXECUTE;

    // 2. Mortal Strike on cooldown
    if (IsSpellReady(bot, SPELL_MORTAL_STRIKE))
        return SPELL_MORTAL_STRIKE;

    // 3. Overpower when available
    if (IsSpellReady(bot, SPELL_OVERPOWER))
        return SPELL_OVERPOWER;

    // 4. Slam as filler
    if (HasEnoughMana(bot, SPELL_SLAM))
        return SPELL_SLAM;

    return 0; // No ability ready
}

bool WarriorDPSStrategy::ShouldUseDefensiveCooldown(BotAI* ai) const {
    Player* bot = ai->GetBot();

    // Use defensive stance if health < 30%
    return bot->HealthBelowPct(30) &&
           !bot->HasAura(SPELL_DEFENSIVE_STANCE) &&
           IsSpellReady(bot, SPELL_DEFENSIVE_STANCE);
}

// Warrior-specific spell IDs
enum WarriorSpells {
    SPELL_EXECUTE = 5308,
    SPELL_MORTAL_STRIKE = 12294,
    SPELL_OVERPOWER = 7384,
    SPELL_SLAM = 1464,
    SPELL_DEFENSIVE_STANCE = 71
};
```

## Thread Safety Considerations

### Critical Sections

1. **Target Selection**: Use thread-safe cell visitors
2. **Spell Casting**: Use SpellPacketBuilder (thread-safe)
3. **State Updates**: Atomic operations only

### Safe Approach

```cpp
// SAFE: Using thread-safe APIs
void CombatStrategy::Update(BotAI* ai, uint32 diff) {
    // All TrinityCore APIs are thread-safe
    Unit* target = SelectTarget(ai); // Uses Cell::VisitAllObjects (thread-safe)

    // Packet-based spell casting (thread-safe)
    SpellPacketBuilder builder;
    builder.CastSpell(bot, spellId, target);
}
```

### Unsafe Approach

```cpp
// UNSAFE: Direct world manipulation
void CombatStrategy::Update(BotAI* ai, uint32 diff) {
    // DON'T: Direct spell casting bypasses thread safety
    Spell* spell = new Spell(bot, spellInfo, TRIGGERED_NONE);
    spell->prepare(targets); // NOT THREAD-SAFE!
}
```

## Performance Considerations

### Memory Usage

- **Per Strategy Instance**: ~200 bytes
- **Shared Spell Data**: Cached globally
- **Target List**: Temporary, freed after Update()

**Total**: ~500 bytes per bot in combat

### CPU Usage

- **Update Frequency**: Every 100ms
- **Target Scan**: O(n) where n = nearby units (typically <50)
- **Ability Check**: O(1) hash table lookup

**Total**: <0.01% CPU per bot

### Network Impact

- **Packets Per Second**: 5-10 (spell casts, movement)
- **Bandwidth**: ~500 bytes/sec per bot
- **100 Bots**: ~50 KB/sec total

## Common Pitfalls

### Pitfall 1: Blocking Target Selection

**Bad**:
```cpp
Unit* SelectTarget(BotAI* ai) {
    // DON'T: Expensive world iteration
    for (auto& pair : sObjectAccessor->GetPlayers()) {
        // Checks EVERY player in the world!
    }
}
```

**Good**:
```cpp
Unit* SelectTarget(BotAI* ai) {
    // DO: Limited radius search
    Trinity::AnyUnfriendlyUnitInObjectRangeCheck check(bot, 30.0f);
    Trinity::UnitListSearcher<...> searcher(bot, targets, check);
    Cell::VisitAllObjects(bot, searcher, 30.0f); // Only nearby units
}
```

### Pitfall 2: Synchronous Spell Casting

**Bad**:
```cpp
// DON'T: Direct spell instantiation
Spell* spell = new Spell(bot, spellInfo, TRIGGERED_NONE);
spell->prepare(targets);
```

**Good**:
```cpp
// DO: Packet-based casting
SpellPacketBuilder builder;
builder.CastSpell(bot, spellId, target); // Thread-safe, async
```

### Pitfall 3: Memory Leaks in Target Lists

**Bad**:
```cpp
std::list<Unit*>* targets = new std::list<Unit*>();
// ... use targets ...
// LEAK: Never deleted!
```

**Good**:
```cpp
std::list<Unit*> targets; // Stack-allocated, auto-freed
// ... use targets ...
// Automatically cleaned up
```

## Testing Strategy

### Unit Tests

```cpp
TEST(CombatStrategy, TargetSelection) {
    MockBotAI ai;
    WarriorDPSStrategy strategy;

    Unit* target = strategy.SelectTarget(&ai);
    EXPECT_NE(target, nullptr);
    EXPECT_TRUE(strategy.IsValidTarget(target));
}
```

### Integration Tests

```cpp
TEST(CombatStrategy, FullRotation) {
    // Spawn bot and hostile NPC
    Player* bot = SpawnTestBot(CLASS_WARRIOR);
    Creature* npc = SpawnHostileNPC();

    // Execute 10-second combat
    for (uint32 i = 0; i < 100; ++i) {
        bot->GetAI()->Update(100);
    }

    // Verify NPC took damage
    EXPECT_LT(npc->GetHealth(), npc->GetMaxHealth());
}
```

## Related Patterns

- [State Manager Pattern](../lifecycle/02_state_manager.md)
- [Packet Handler Pattern](../packets/01_packet_handling.md)
- [Healing Strategy Pattern](02_healing_strategy.md)
- [Tank Strategy Pattern](03_tank_strategy.md)

## Real-World Examples

### Example 1: Warrior Arms Rotation

See: `src/modules/Playerbot/AI/Strategies/WarriorArmsStrategy.cpp`

### Example 2: Mage Frost Rotation

See: `src/modules/Playerbot/AI/Strategies/MageFrostStrategy.cpp`

### Example 3: Druid Feral Rotation

See: `src/modules/Playerbot/AI/Strategies/DruidFeralStrategy.cpp`

## Version History

- **v2.0.0** (2025-10-31): Phase 5 knowledge base integration
- **v1.2.0** (2025-10-29): Added packet-based spell casting
- **v1.0.0** (2025-10-28): Initial combat strategy pattern
