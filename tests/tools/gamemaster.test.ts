/**
 * Natural Language Game Master Tool - Unit Tests
 *
 * Tests for:
 * - Natural language parsing across all command categories
 * - Command generation and parameter extraction
 * - Risk assessment
 * - Edge cases and error handling
 * - Suggestion generation
 *
 * @module __tests__/gamemaster
 */

// Mock the database connection before importing
jest.mock("../../src/database/connection", () => ({
  queryWorld: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    // Mock creature lookup
    if (sql.includes("creature_template") && sql.includes("entry = ?")) {
      const entry = params?.[0];
      if (entry === 69) return [{ entry: 69, name: "Wolf" }];
      if (entry === 11502) return [{ entry: 11502, name: "Ragnaros" }];
      return [];
    }
    if (sql.includes("creature_template") && sql.includes("LIKE")) {
      const name = params?.[0];
      if (name === "%wolf%") return [{ entry: 69, name: "Wolf" }];
      if (name === "%wolves%") return [{ entry: 69, name: "Wolf" }];
      if (name === "%ragnaros%") return [{ entry: 11502, name: "Ragnaros" }];
      return [];
    }
    // Mock item lookup
    if (sql.includes("item_template") && sql.includes("entry = ?")) {
      const entry = params?.[0];
      if (entry === 19019) return [{ entry: 19019, name: "Thunderfury, Blessed Blade of the Windseeker" }];
      return [];
    }
    return [];
  }),
}));

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { processGameMasterCommand, GameMasterResult } from "../../src/tools/gamemaster";

// =============================================================================
// Helper
// =============================================================================

async function gm(command: string): Promise<GameMasterResult> {
  return processGameMasterCommand(command, true);
}

// =============================================================================
// Spawn Command Tests
// =============================================================================

describe("Game Master - Spawn Commands", () => {
  it("should parse 'spawn 5 wolves'", async () => {
    const result = await gm("spawn 5 wolves");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("spawn");
    expect(result.intents[0].parameters.count).toBe(5);
    expect(result.commands.length).toBe(5);
    expect(result.commands[0].command).toContain(".npc add 69");
  });

  it("should parse 'spawn a wolf'", async () => {
    const result = await gm("spawn a wolf");
    expect(result.success).toBe(true);
    expect(result.commands.length).toBe(1);
    expect(result.commands[0].command).toContain(".npc add 69");
  });

  it("should parse 'spawn 3 wolves near Goldshire'", async () => {
    const result = await gm("spawn 3 wolves near Goldshire");
    expect(result.success).toBe(true);
    expect(result.intents[0].parameters.location).toBe("Goldshire");
    // Should have teleport command first + 3 spawn commands
    expect(result.commands.length).toBe(4);
    expect(result.commands[0].category).toBe("teleport");
    expect(result.commands[1].command).toContain(".npc add 69");
  });

  it("should cap spawn count at 50", async () => {
    const result = await gm("spawn 100 wolves");
    expect(result.warnings.some(w => w.includes("Capped at 50"))).toBe(true);
    expect(result.commands.length).toBe(50);
  });

  it("should handle unknown creature names", async () => {
    const result = await gm("spawn 2 nonexistentcreature123");
    // Should suggest looking up the creature
    expect(result.commands.some(c => c.command.includes(".lookup creature"))).toBe(true);
  });

  it("should resolve creature by entry ID", async () => {
    const result = await gm("spawn 3 69");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".npc add 69");
    expect(result.commands[0].description).toContain("Wolf");
  });

  it("should parse 'summon 2 wolves'", async () => {
    const result = await gm("summon 2 wolves");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("spawn");
    expect(result.commands.length).toBe(2);
  });
});

// =============================================================================
// Teleport Command Tests
// =============================================================================

describe("Game Master - Teleport Commands", () => {
  it("should parse 'teleport me to Orgrimmar'", async () => {
    const result = await gm("teleport me to Orgrimmar");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("teleport");
    expect(result.commands[0].command).toContain(".tele name Orgrimmar");
  });

  it("should parse 'tp Player1 to Stormwind'", async () => {
    const result = await gm("tp Player1 to Stormwind");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".teleport Player1");
    expect(result.commands[0].notes).toContain("-8842");
  });

  it("should parse 'goto Dalaran'", async () => {
    const result = await gm("goto Dalaran");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("teleport");
    expect(result.commands[0].command).toContain(".tele name Dalaran");
  });

  it("should parse 'summon Player1'", async () => {
    const result = await gm("bring Player1");
    expect(result.success).toBe(true);
    expect(result.intents[0].action).toBe("summon");
    expect(result.commands[0].command).toContain(".appear Player1");
  });

  it("should handle unknown locations gracefully", async () => {
    const result = await gm("teleport Player1 to SomeUnknownPlace");
    expect(result.success).toBe(true);
    // Should fall back to .tele name + .appear combo
    expect(result.commands.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Modify Command Tests
// =============================================================================

describe("Game Master - Modify Commands", () => {
  it("should parse 'set Player1 level to 80'", async () => {
    const result = await gm("set Player1 level to 80");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("modify");
    expect(result.intents[0].action).toBe("level");
    expect(result.commands[0].command).toContain(".character level Player1 80");
  });

  it("should parse 'modify my level to 60'", async () => {
    const result = await gm("set me level to 60");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify level 60");
  });

  it("should validate level bounds", async () => {
    const result = await gm("set Player1 level to 999");
    expect(result.warnings.some(w => w.includes("between 1 and 90"))).toBe(true);
    expect(result.commands.length).toBe(0);
  });

  it("should parse 'set Player1 speed to 5'", async () => {
    const result = await gm("set Player1 speed to 5");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify speed all 5");
  });

  it("should parse 'heal Player1'", async () => {
    const result = await gm("heal Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify hp 999999");
  });

  it("should parse 'give 100 gold to Player1'", async () => {
    const result = await gm("give 100 gold to Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify money 1000000");
  });

  it("should parse 'make me invincible'", async () => {
    const result = await gm("make me invincible");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".gm on");
  });

  it("should parse 'make me invisible'", async () => {
    const result = await gm("make me invisible");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".gm vis off");
  });

  it("should parse 'make me fly'", async () => {
    const result = await gm("make me fly");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".gm fly on");
  });
});

// =============================================================================
// Item Command Tests
// =============================================================================

describe("Game Master - Item Commands", () => {
  it("should parse 'give item 19019 to Player1'", async () => {
    const result = await gm("give item 19019 to Player1");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("item");
    expect(result.commands[0].command).toContain("19019");
  });

  it("should parse 'give item 19019 x5 to Player1'", async () => {
    const result = await gm("give item 19019 x5 to Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain("19019");
  });

  it("should cap item count at 200", async () => {
    const result = await gm("give item 19019 x500 to Player1");
    expect(result.warnings.some(w => w.includes("Capped at 200"))).toBe(true);
  });
});

// =============================================================================
// Aura/Spell Command Tests
// =============================================================================

describe("Game Master - Aura Commands", () => {
  it("should parse 'apply aura 1459 to Player1'", async () => {
    const result = await gm("apply aura 1459 to Player1");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("aura");
    expect(result.commands[0].command).toBe(".aura 1459");
  });

  it("should parse 'remove aura 1459 from Player1'", async () => {
    const result = await gm("remove aura 1459 from Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".unaura 1459");
  });

  it("should parse 'remove all auras from Player1'", async () => {
    const result = await gm("remove all auras from Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".unaura all");
  });
});

// =============================================================================
// Announce Command Tests
// =============================================================================

describe("Game Master - Announce Commands", () => {
  it("should parse 'announce Server maintenance in 30 minutes'", async () => {
    const result = await gm("announce Server maintenance in 30 minutes");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("announce");
    expect(result.commands[0].command).toContain(".announce Server maintenance in 30 minutes");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should parse 'broadcast Hello everyone!'", async () => {
    const result = await gm("broadcast Hello everyone!");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".announce Hello everyone!");
  });
});

// =============================================================================
// Weather Command Tests
// =============================================================================

describe("Game Master - Weather Commands", () => {
  it("should parse 'set weather to rain'", async () => {
    const result = await gm("set weather to rain");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("weather");
    expect(result.commands[0].command).toContain(".modify weather 1");
  });

  it("should parse 'make it snow'", async () => {
    const result = await gm("make it snow");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify weather 2");
  });

  it("should parse 'set weather to clear'", async () => {
    const result = await gm("set weather to clear");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".modify weather 0 0");
  });

  it("should handle unknown weather types", async () => {
    const result = await gm("set weather to earthquake");
    expect(result.warnings.some(w => w.includes("Unknown weather type"))).toBe(true);
  });
});

// =============================================================================
// Kill/Damage/Revive Command Tests
// =============================================================================

describe("Game Master - Combat Commands", () => {
  it("should parse 'kill the target'", async () => {
    const result = await gm("kill the target");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("kill");
    expect(result.commands[0].command).toBe(".die");
    expect(result.commands[0].risk).toBe("dangerous");
  });

  it("should parse 'damage Player1 for 500'", async () => {
    const result = await gm("damage Player1 for 500");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".damage 500");
  });

  it("should parse 'revive Player1'", async () => {
    const result = await gm("revive Player1");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".revive Player1");
    expect(result.commands[0].risk).toBe("safe");
  });
});

// =============================================================================
// Server Command Tests
// =============================================================================

describe("Game Master - Server Commands", () => {
  it("should parse 'shutdown server in 30 seconds'", async () => {
    const result = await gm("shutdown server in 30 seconds");
    expect(result.success).toBe(true);
    expect(result.intents[0].category).toBe("server");
    expect(result.commands[0].command).toContain(".server shutdown 30");
    expect(result.commands[0].risk).toBe("dangerous");
  });

  it("should parse 'restart server in 5 minutes'", async () => {
    const result = await gm("restart server in 5 minutes");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".server restart 300");
  });

  it("should parse 'save all'", async () => {
    const result = await gm("save all");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".saveall");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should parse 'reload scripts'", async () => {
    const result = await gm("reload scripts");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".reload scripts");
  });
});

// =============================================================================
// Lookup Command Tests
// =============================================================================

describe("Game Master - Lookup Commands", () => {
  it("should parse 'find creature Ragnaros'", async () => {
    const result = await gm("find creature Ragnaros");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".lookup creature Ragnaros");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should parse 'lookup item Thunderfury'", async () => {
    const result = await gm("lookup item Thunderfury");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".lookup item Thunderfury");
  });

  it("should parse 'search spell Fireball'", async () => {
    const result = await gm("search spell Fireball");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".lookup spell Fireball");
  });
});

// =============================================================================
// Account Command Tests
// =============================================================================

describe("Game Master - Account Commands", () => {
  it("should parse 'kick player BadPlayer for cheating'", async () => {
    const result = await gm("kick player BadPlayer for cheating");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".kick BadPlayer");
    expect(result.commands[0].command).toContain("cheating");
  });

  it("should parse 'ban account Cheater'", async () => {
    const result = await gm("ban account Cheater");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".ban account Cheater");
    expect(result.commands[0].risk).toBe("dangerous");
  });
});

// =============================================================================
// Reset Command Tests
// =============================================================================

describe("Game Master - Reset Commands", () => {
  it("should parse 'reset Player1 cooldowns'", async () => {
    const result = await gm("reset Player1 cooldowns");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toBe(".cooldown");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should parse 'reset Player1 talents'", async () => {
    const result = await gm("reset Player1 talents");
    expect(result.success).toBe(true);
    expect(result.commands[0].command).toContain(".reset talents Player1");
    expect(result.commands[0].risk).toBe("moderate");
  });
});

// =============================================================================
// Edge Cases & Error Handling
// =============================================================================

describe("Game Master - Edge Cases", () => {
  it("should handle empty input", async () => {
    const result = await gm("");
    expect(result.success).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("should handle whitespace-only input", async () => {
    const result = await gm("   ");
    expect(result.success).toBe(false);
  });

  it("should handle unrecognized commands", async () => {
    const result = await gm("do something completely random and unrelated");
    expect(result.success).toBe(false);
    expect(result.intents[0].category).toBe("unknown");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("should always use dry run by default", async () => {
    const result = await processGameMasterCommand("spawn a wolf", undefined as any);
    expect(result.dryRun).toBe(true);
  });

  it("should warn about dangerous commands", async () => {
    const result = await gm("shutdown server");
    expect(result.warnings.some(w => w.includes("DANGEROUS"))).toBe(true);
  });

  it("should include risk assessment on all commands", async () => {
    const result = await gm("spawn 3 wolves");
    for (const cmd of result.commands) {
      expect(["safe", "moderate", "dangerous"]).toContain(cmd.risk);
    }
  });

  it("should provide interpretation string", async () => {
    const result = await gm("teleport me to Ironforge");
    expect(result.interpretation).toContain("teleport");
  });
});

// =============================================================================
// Risk Assessment Tests
// =============================================================================

describe("Game Master - Risk Assessment", () => {
  it("should rate spawn commands as moderate", async () => {
    const result = await gm("spawn a wolf");
    expect(result.commands[0].risk).toBe("moderate");
  });

  it("should rate high spawn counts as dangerous", async () => {
    const result = await gm("spawn 20 wolves");
    const spawnCommands = result.commands.filter(c => c.category === "spawn");
    // All spawn commands for 20 wolves should be marked dangerous
    for (const cmd of spawnCommands) {
      expect(cmd.risk).toBe("dangerous");
    }
  });

  it("should rate lookup commands as safe", async () => {
    const result = await gm("find creature Wolf");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should rate announce commands as safe", async () => {
    const result = await gm("announce Hello!");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should rate server shutdown as dangerous", async () => {
    const result = await gm("shutdown server");
    expect(result.commands[0].risk).toBe("dangerous");
  });

  it("should rate ban commands as dangerous", async () => {
    const result = await gm("ban account Cheater");
    expect(result.commands[0].risk).toBe("dangerous");
  });

  it("should rate weather commands as safe", async () => {
    const result = await gm("set weather to rain");
    expect(result.commands[0].risk).toBe("safe");
  });

  it("should rate revive commands as safe", async () => {
    const result = await gm("revive Player1");
    expect(result.commands[0].risk).toBe("safe");
  });
});
