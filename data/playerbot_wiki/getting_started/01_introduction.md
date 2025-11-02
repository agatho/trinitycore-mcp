# Introduction to TrinityCore Playerbot Development

**Tags**: [getting-started, introduction, overview, playerbot]
**Difficulty**: basic
**Category**: getting_started

## Overview

TrinityCore Playerbot is an AI-controlled player bot system that enables single-player World of Warcraft gameplay. This guide introduces the core concepts and architecture of the Playerbot module.

## What is Playerbot?

Playerbot transforms TrinityCore into a single-player capable MMORPG by providing:
- AI-controlled player characters
- Autonomous decision-making systems
- Group coordination capabilities
- Quest completion automation
- Combat AI for all classes and specs

## Key Components

### 1. BotAI (Core Intelligence)
The central decision-making system that controls bot behavior.

```cpp
class BotAI {
    void Update(uint32 diff);
    void DoAction(uint32 actionId);
    bool NeedHeal() const;
    bool NeedMana() const;
};
```

### 2. BotSession (Network Interface)
Manages bot network communication through packet-based architecture.

```cpp
class BotSession : public WorldSession {
    void HandleMovementPackets();
    void HandleSpellCasting();
    void HandleCombatUpdates();
};
```

### 3. StateManager (Behavior Control)
Tracks and transitions between bot states (combat, idle, following, etc.).

```cpp
enum BotState {
    BOT_STATE_IDLE,
    BOT_STATE_COMBAT,
    BOT_STATE_FOLLOWING,
    BOT_STATE_DEAD
};
```

## Architecture Overview

```
Player Command
    ↓
BotManager
    ↓
BotAI ←→ StateManager
    ↓
BotSession (Packets)
    ↓
TrinityCore World
```

## Performance Targets

- **CPU**: <0.1% per bot
- **Memory**: <10MB per bot
- **Scalability**: 100-500 concurrent bots
- **Response Time**: <50ms for AI decisions

## Module Location

All Playerbot code is located in:
```
src/modules/Playerbot/
├── AI/           # AI strategies and decision-making
├── Session/      # Network session management
├── Lifecycle/    # Bot creation and destruction
├── Packets/      # Packet handling
└── Scripts/      # Event hooks
```

## Development Principles

1. **Module-Only Implementation**: All code in `src/modules/Playerbot/`
2. **TrinityCore API Usage**: Never bypass core systems
3. **Thread Safety**: All operations must be thread-safe
4. **Performance First**: <0.1% CPU per bot target
5. **Packet-Based**: Use packets for all game interactions

## Next Steps

- Read [02_setup_development_environment.md](02_setup_development_environment.md)
- Understand [03_bot_lifecycle.md](03_bot_lifecycle.md)
- Learn [04_first_bot_ai.md](04_first_bot_ai.md)

## Common Pitfalls

### Pitfall 1: Direct World Access
**Bad**:
```cpp
// DON'T: Direct world manipulation
bot->SetHealth(bot->GetMaxHealth());
```

**Good**:
```cpp
// DO: Use packet-based healing
SpellPacketBuilder builder;
builder.CastSpell(bot, healSpellId, bot);
```

### Pitfall 2: Blocking Operations
**Bad**:
```cpp
// DON'T: Blocking database queries in Update()
QueryResult result = WorldDatabase.Query("SELECT ...");
```

**Good**:
```cpp
// DO: Async queries with callbacks
WorldDatabase.AsyncQuery("SELECT ...", [](QueryResult result) {
    // Handle result
});
```

## Related Documents

- [Bot AI Architecture](../patterns/combat/01_combat_ai_strategy.md)
- [Packet-Based Communication](../patterns/packets/01_packet_handling.md)
- [Thread Safety Guidelines](../advanced/01_thread_safety.md)

## Version History

- **v2.0.0** (2025-10-31): Phase 5 knowledge base integration
- **v1.0.0** (2025-10-28): Initial Playerbot implementation
