/**
 * TrinityCore API documentation tool
 */

// Common TrinityCore API documentation
const API_DOCS: { [className: string]: string } = {
  Player: `
# Player Class API

## Common Methods

### GetGUID() -> ObjectGuid
Returns the player's GUID.

### GetName() -> string
Returns the player's character name.

### GetLevel() -> uint8
Returns the player's level.

### SetLevel(level: uint8) -> void
Sets the player's level.

### GetMoney() -> uint32
Returns the player's current copper.

### ModifyMoney(amount: int32) -> bool
Modifies the player's money by the specified amount.

### AddItem(itemId: uint32, count: uint32) -> Item*
Adds an item to the player's inventory.

### GetHealth() -> uint32
Returns current health.

### GetMaxHealth() -> uint32
Returns maximum health.

### SetHealth(health: uint32) -> void
Sets current health.

### CastSpell(target: Unit*, spellId: uint32) -> SpellCastResult
Casts a spell on the target.

### Teleport(mapId: uint32, x: float, y: float, z: float, orientation: float) -> bool
Teleports the player to the specified location.

### LearnSpell(spellId: uint32) -> void
Teaches the player a spell.

### SendChatMessage(text: string, chatType: ChatMsg) -> void
Sends a chat message to the player.
`,

  Unit: `
# Unit Class API

## Common Methods

### GetHealth() -> uint32
Returns current health.

### GetMaxHealth() -> uint32
Returns maximum health.

### SetHealth(health: uint32) -> void
Sets current health.

### GetPower(powerType: Powers) -> uint32
Returns current power for the specified type (mana, rage, energy, etc.).

### GetMaxPower(powerType: Powers) -> uint32
Returns maximum power for the specified type.

### CastSpell(target: Unit*, spellId: uint32, triggered: bool) -> SpellCastResult
Casts a spell on the target.

### Attack(target: Unit*, meleeAttack: bool) -> bool
Attacks the target.

### IsAlive() -> bool
Returns true if the unit is alive.

### IsDead() -> bool
Returns true if the unit is dead.

### Kill(victim: Unit*) -> void
Kills the victim unit.

### GetVictim() -> Unit*
Returns the unit's current combat target.

### IsInCombat() -> bool
Returns true if the unit is in combat.
`,

  Creature: `
# Creature Class API (inherits from Unit)

## Common Methods

### GetEntry() -> uint32
Returns the creature's entry ID.

### GetCreatureTemplate() -> CreatureTemplate*
Returns the creature's template data.

### SetWalk(enable: bool) -> void
Sets walk mode on/off.

### SetReactState(state: ReactStates) -> void
Sets the creature's react state (aggressive, defensive, passive).

### GetAI() -> CreatureAI*
Returns the creature's AI.

### Say(text: string, language: Language) -> void
Makes the creature say something.

### Yell(text: string, language: Language) -> void
Makes the creature yell something.

### SetHomePosition(x: float, y: float, z: float, o: float) -> void
Sets the creature's home position.

### GetRespawnTime() -> time_t
Returns the respawn time.

### SetRespawnTime(respawn: uint32) -> void
Sets the respawn time in seconds.
`,

  GameObject: `
# GameObject Class API

## Common Methods

### GetEntry() -> uint32
Returns the gameobject's entry ID.

### GetGoType() -> GameobjectTypes
Returns the gameobject type.

### SetGoState(state: GOState) -> void
Sets the gameobject state (ready, active, etc.).

### Use(user: Unit*) -> void
Uses the gameobject.

### SetLootState(state: LootState) -> void
Sets the loot state.

### GetLootRecipient() -> Player*
Returns the loot recipient.

### EnableCollision(enable: bool) -> void
Enables/disables collision.
`,

  WorldSession: `
# WorldSession Class API

## Common Methods

### GetPlayer() -> Player*
Returns the session's player.

### GetAccountId() -> uint32
Returns the account ID.

### SendPacket(packet: WorldPacket*) -> void
Sends a packet to the client.

### LogoutPlayer(save: bool) -> void
Logs out the player.

### KickPlayer() -> void
Kicks the player from the server.

### GetSecurity() -> AccountTypes
Returns the account security level.
`,
};

export async function getTrinityAPI(className: string, methodName?: string): Promise<string> {
  const docs = API_DOCS[className];

  if (!docs) {
    return `API documentation for class "${className}" not found.

Available classes:
- Player
- Unit
- Creature
- GameObject
- WorldSession

For complete API documentation, visit:
https://trinitycore.info/en/home
https://github.com/TrinityCore/TrinityCore/tree/master/src/server/game

Note: This is a limited documentation set. Full API requires indexing the TrinityCore codebase.`;
  }

  if (methodName) {
    const lines = docs.split("\n");
    const methodLines: string[] = [];
    let capturing = false;

    for (const line of lines) {
      if (line.includes(methodName)) {
        capturing = true;
      }
      if (capturing) {
        methodLines.push(line);
        if (line.trim() === "" && methodLines.length > 1) {
          break;
        }
      }
    }

    if (methodLines.length > 0) {
      return methodLines.join("\n");
    } else {
      return `Method "${methodName}" not found in ${className} documentation.\n\n` + docs;
    }
  }

  return docs;
}
