/**
 * Dungeon/Raid Strategy MCP
 *
 * Boss mechanics, trash strategies, dungeon layouts, CC targets,
 * group composition optimization for group content.
 *
 * @module dungeonstrategy
 */

import { queryWorld } from "../database/connection";
import { logger } from '../utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BossMechanicInfo {
  creatureId: number;
  bossName: string;
  instanceId: number;
  instanceName: string;
  difficulty: "normal" | "heroic" | "mythic";

  phases: BossPhase[];
  abilities: BossAbility[];
  strategyNotes: string[];
  tankCount: number;
  healerCount: number;
  dpsCount: number;
  estimatedDuration: number; // seconds
}

export interface BossPhase {
  phaseNumber: number;
  healthPercent: number; // When phase starts
  description: string;
  mechanics: string[];
  duration?: number; // seconds
  priority: "survival" | "dps" | "healing";
}

export interface BossAbility {
  spellId: number;
  name: string;
  type: "tank_mechanic" | "raid_damage" | "cc" | "dispel" | "interrupt" | "movement";
  description: string;
  counterplay: string;
  frequency: number; // seconds between casts
  priority: "critical" | "high" | "medium" | "low";
}

export interface TrashPackStrategy {
  packId: string;
  location: string;
  enemies: Array<{
    creatureId: number;
    name: string;
    count: number;
    role: "priority_target" | "cc_target" | "aoe" | "ignore";
  }>;
  strategy: string;
  ccRecommendations: Array<{
    targetName: string;
    ccType: "polymorph" | "sap" | "hex" | "fear" | "stun";
    reason: string;
  }>;
  dangerRating: "trivial" | "easy" | "moderate" | "dangerous" | "deadly";
  estimatedTime: number; // seconds
}

export interface DungeonLayout {
  dungeonId: number;
  name: string;
  levelRange: { min: number; max: number };
  estimatedDuration: number; // minutes
  bosses: BossMechanicInfo[];
  trashPacks: TrashPackStrategy[];
  optimalRoute: string[];
  skipablePacks: string[];
}

export interface GroupComposition {
  tanks: number;
  healers: number;
  dps: number;
  classes: { [className: string]: number };
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface MythicPlusInfo {
  keystoneLevel: number;
  affixes: string[];
  timeLimitMinutes: number;
  enemyHealthMod: number;
  enemyDamageMod: number;
  strategy: string;
  priorityInterrupts: number[];
  dangerousAffixCombos: string[];
}

// ============================================================================
// BOSS MECHANICS
// ============================================================================

/**
 * Get boss mechanics and strategy
 */
export async function getBossMechanics(
  bossCreatureId: number
): Promise<BossMechanicInfo> {
  // Query creature for boss info
  const query = `
    SELECT
      ct.entry, ct.name, it.map as instanceId
    FROM creature_template ct
    LEFT JOIN creature c ON ct.entry = c.id
    LEFT JOIN instance_template it ON c.map = it.map
    WHERE ct.entry = ?
    LIMIT 1
  `;

  const results = await queryWorld(query, [bossCreatureId]);

  if (!results || results.length === 0) {
    throw new Error(`Boss ${bossCreatureId} not found`);
  }

  const boss = results[0];

  // Get boss spells
  const spellQuery = `
    SELECT Spell1, Spell2, Spell3, Spell4, Spell5, Spell6, Spell7, Spell8
    FROM creature_template
    WHERE entry = ?
  `;

  const spells = await queryWorld(spellQuery, [bossCreatureId]);

  const abilities: BossAbility[] = [];

  if (spells && spells.length > 0) {
    for (let i = 1; i <= 8; i++) {
      const spellId = spells[0][`Spell${i}`];
      if (spellId && spellId > 0) {
        abilities.push({
          spellId,
          name: `Ability ${spellId}`,
          type: "raid_damage", // Would need spell analysis
          description: `Boss ability ${spellId}`,
          counterplay: "Analysis needed",
          frequency: 30,
          priority: "medium"
        });
      }
    }
  }

  return {
    creatureId: boss.entry,
    bossName: boss.name,
    instanceId: boss.instanceId || 0,
    instanceName: "Unknown Instance",
    difficulty: "normal",
    phases: [
      {
        phaseNumber: 1,
        healthPercent: 100,
        description: "Main phase",
        mechanics: ["Standard rotation"],
        priority: "dps"
      }
    ],
    abilities,
    strategyNotes: [
      "Interrupt priority spells",
      "Spread for AoE mechanics",
      "Move out of bad stuff"
    ],
    tankCount: 2,
    healerCount: 2,
    dpsCount: 6,
    estimatedDuration: 300
  };
}

/**
 * Analyze trash pack difficulty
 */
export function analyzeTrashPack(
  packId: string,
  enemies: Array<{ creatureId: number; count: number }>
): TrashPackStrategy {
  // Simplified analysis
  const totalEnemies = enemies.reduce((sum, e) => sum + e.count, 0);

  let dangerRating: TrashPackStrategy["dangerRating"] = "easy";
  if (totalEnemies > 6) dangerRating = "moderate";
  if (totalEnemies > 10) dangerRating = "dangerous";

  return {
    packId,
    location: "Dungeon corridor",
    enemies: enemies.map(e => ({
      creatureId: e.creatureId,
      name: `Creature ${e.creatureId}`,
      count: e.count,
      role: e.count === 1 ? "priority_target" : "aoe"
    })),
    strategy: totalEnemies > 4 ? "AoE down" : "Focus fire",
    ccRecommendations: [],
    dangerRating,
    estimatedTime: totalEnemies * 5
  };
}

/**
 * Get optimal group composition
 */
export function getOptimalGroupComposition(
  contentType: "raid" | "dungeon" | "mythic_plus",
  difficulty: "normal" | "heroic" | "mythic"
): GroupComposition {
  let tanks = 0;
  let healers = 0;
  let dps = 0;

  if (contentType === "raid") {
    tanks = difficulty === "mythic" ? 2 : 2;
    healers = difficulty === "mythic" ? 5 : 4;
    dps = difficulty === "mythic" ? 13 : 14;
  } else if (contentType === "dungeon" || contentType === "mythic_plus") {
    tanks = 1;
    healers = 1;
    dps = 3;
  }

  return {
    tanks,
    healers,
    dps,
    classes: {}, // Would calculate ideal class distribution
    score: 85,
    strengths: ["Balanced composition", "Good utility coverage"],
    weaknesses: ["Could use more interrupts"],
    recommendations: [
      "Add a class with Bloodlust/Heroism",
      "Ensure interrupt coverage for priority casts"
    ]
  };
}

/**
 * Get Mythic+ specific strategy
 */
export function getMythicPlusStrategy(
  keystoneLevel: number,
  affixes: string[]
): MythicPlusInfo {
  const healthMod = 1 + (keystoneLevel * 0.08);
  const damageMod = 1 + (keystoneLevel * 0.10);

  return {
    keystoneLevel,
    affixes,
    timeLimitMinutes: 30,
    enemyHealthMod: healthMod,
    enemyDamageMod: damageMod,
    strategy: `At key level ${keystoneLevel}, enemies have ${(healthMod * 100).toFixed(0)}% health`,
    priorityInterrupts: [],
    dangerousAffixCombos: []
  };
}

/**
 * Recommend CC targets in pull
 */
export function recommendCCTargets(
  enemies: Array<{ creatureId: number; name: string; abilities: string[] }>
): Array<{ targetName: string; reason: string; priority: number }> {
  const recommendations: Array<any> = [];

  for (const enemy of enemies) {
    let priority = 0;
    let reason = "";

    // Check for dangerous abilities
    if (enemy.abilities.some(a => a.includes("Heal") || a.includes("heal"))) {
      priority = 10;
      reason = "Has healing ability - must CC";
    } else if (enemy.abilities.some(a => a.includes("Cast") || a.includes("cast"))) {
      priority = 7;
      reason = "Caster - should CC to reduce damage";
    }

    if (priority > 0) {
      recommendations.push({
        targetName: enemy.name,
        reason,
        priority
      });
    }
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Get complete dungeon layout and strategy
 */
export async function getDungeonLayout(dungeonMapId: number): Promise<DungeonLayout> {
  // Query instance template for dungeon info
  const query = `
    SELECT map, levelMin, levelMax
    FROM instance_template
    WHERE map = ?
  `;

  const results = await queryWorld(query, [dungeonMapId]);

  if (!results || results.length === 0) {
    throw new Error(`Dungeon ${dungeonMapId} not found`);
  }

  const dungeon = results[0];

  // TrinityCore 11.2.7: rank is now Classification (3 = Boss)
  const bossQuery = `
    SELECT DISTINCT ct.entry, ct.name
    FROM creature_template ct
    JOIN creature c ON ct.entry = c.id
    WHERE c.map = ? AND ct.Classification = 3
    ORDER BY c.position_x
  `;

  const bossResults = await queryWorld(bossQuery, [dungeonMapId]);
  const bosses: BossMechanicInfo[] = [];

  for (const boss of bossResults) {
    try {
      const bossInfo = await getBossMechanics(boss.entry);
      bosses.push(bossInfo);
    } catch (e) {
      // Skip bosses that can't be loaded
      logger.warn(`Could not load boss ${boss.entry}: ${e}`);
    }
  }

  return {
    dungeonId: dungeonMapId,
    name: `Dungeon ${dungeonMapId}`,
    levelRange: {
      min: dungeon.levelMin || 1,
      max: dungeon.levelMax || 80
    },
    estimatedDuration: bosses.length * 5, // 5 minutes per boss estimate
    bosses,
    trashPacks: [], // Would be populated from trash analysis
    optimalRoute: bosses.map(b => `Boss: ${b.bossName}`),
    skipablePacks: []
  };
}

/**
 * Analyze pull difficulty and recommend strategy
 */
export function analyzePullDifficulty(
  enemies: Array<{ creatureId: number; name: string; level: number; elite: boolean }>,
  groupLevel: number,
  groupSize: number
): {
  difficulty: "trivial" | "easy" | "moderate" | "hard" | "deadly";
  strategy: string;
  warnings: string[];
  estimatedTime: number;
} {
  const totalEnemies = enemies.length;
  const eliteCount = enemies.filter(e => e.elite).length;
  const avgEnemyLevel = enemies.reduce((sum, e) => sum + e.level, 0) / totalEnemies;
  const levelDiff = avgEnemyLevel - groupLevel;

  let difficulty: "trivial" | "easy" | "moderate" | "hard" | "deadly" = "easy";
  const warnings: string[] = [];
  let strategy = "Standard pull";

  // Calculate difficulty
  if (levelDiff > 3 || eliteCount > groupSize) {
    difficulty = "deadly";
    warnings.push("Enemies significantly higher level or outnumber group");
  } else if (levelDiff > 1 || eliteCount > 2) {
    difficulty = "hard";
    warnings.push("Challenging pull - use cooldowns");
  } else if (totalEnemies > 5 || eliteCount > 1) {
    difficulty = "moderate";
    strategy = "AoE if available, otherwise focus fire";
  } else if (totalEnemies <= 2) {
    difficulty = "trivial";
    strategy = "Quick kill";
  }

  // Calculate estimated time (seconds)
  const baseTime = totalEnemies * 8; // 8 seconds per enemy
  const eliteModifier = eliteCount * 10; // +10s per elite
  const estimatedTime = baseTime + eliteModifier;

  return {
    difficulty,
    strategy,
    warnings,
    estimatedTime
  };
}

/**
 * Recommend interrupt rotation for group
 */
export function recommendInterruptRotation(
  groupMembers: Array<{ className: string; specName: string }>,
  prioritySpells: Array<{ spellId: number; name: string; castTime: number }>
): Array<{
  player: string;
  interruptAbility: string;
  targetSpell: string;
  timing: string;
}> {
  const rotation: Array<any> = [];

  // Map classes to their interrupt abilities
  const interruptAbilities: { [key: string]: string } = {
    "Warrior": "Pummel",
    "Paladin": "Rebuke",
    "Hunter": "Counter Shot",
    "Rogue": "Kick",
    "Priest": "Silence",
    "Death Knight": "Mind Freeze",
    "Shaman": "Wind Shear",
    "Mage": "Counterspell",
    "Warlock": "Spell Lock",
    "Monk": "Spear Hand Strike",
    "Druid": "Skull Bash",
    "Demon Hunter": "Disrupt",
    "Evoker": "Quell"
  };

  let playerIndex = 0;

  for (const spell of prioritySpells) {
    const player = groupMembers[playerIndex % groupMembers.length];
    const interrupt = interruptAbilities[player.className] || "Interrupt";

    rotation.push({
      player: `${player.className} (${player.specName})`,
      interruptAbility: interrupt,
      targetSpell: spell.name,
      timing: `${(spell.castTime / 1000).toFixed(1)}s cast - interrupt ASAP`
    });

    playerIndex++;
  }

  return rotation;
}

/**
 * Calculate optimal route through dungeon
 */
export function calculateOptimalRoute(
  dungeon: DungeonLayout,
  objectives: Array<{ type: "boss" | "trash" | "quest"; priority: number; location: string }>
): {
  route: string[];
  estimatedTime: number;
  trashKills: number;
  bossKills: number;
} {
  const route: string[] = [];
  let estimatedTime = 0;
  let trashKills = 0;
  let bossKills = 0;

  // Sort objectives by priority
  const sortedObjectives = objectives.sort((a, b) => b.priority - a.priority);

  for (const objective of sortedObjectives) {
    route.push(objective.location);

    if (objective.type === "boss") {
      bossKills++;
      estimatedTime += 300; // 5 minutes per boss
    } else if (objective.type === "trash") {
      trashKills++;
      estimatedTime += 60; // 1 minute per trash pack
    }
  }

  return {
    route,
    estimatedTime,
    trashKills,
    bossKills
  };
}

/**
 * Recommend pre-pull preparations
 */
export function recommendPrePullPreparations(
  encounter: BossMechanicInfo | TrashPackStrategy,
  groupComposition: GroupComposition
): {
  buffs: string[];
  assignments: Array<{ role: string; task: string }>;
  consumables: string[];
  warnings: string[];
} {
  const buffs: string[] = [];
  const assignments: Array<{ role: string; task: string }> = [];
  const consumables: string[] = [];
  const warnings: string[] = [];

  // Standard buffs
  if (groupComposition.tanks > 0) {
    buffs.push("Tank Fortitude buff");
    assignments.push({ role: "Tank", task: "Establish threat on pull" });
  }

  if (groupComposition.healers > 0) {
    buffs.push("Healer mana buff");
    assignments.push({ role: "Healer", task: "Monitor tank health" });
  }

  buffs.push("Mark of the Wild", "Arcane Intellect", "Power Word: Fortitude");

  // Check for boss-specific mechanics
  if ('abilities' in encounter) {
    // Boss encounter
    const boss = encounter as BossMechanicInfo;

    for (const ability of boss.abilities) {
      if (ability.type === "interrupt" && ability.priority === "critical") {
        assignments.push({
          role: "Interrupter",
          task: `Interrupt ${ability.name} - CRITICAL`
        });
        warnings.push(`CRITICAL: Must interrupt ${ability.name}`);
      }

      if (ability.type === "dispel") {
        assignments.push({
          role: "Dispeller",
          task: `Dispel ${ability.name}`
        });
      }
    }

    // Recommend consumables based on difficulty
    if (boss.estimatedDuration > 300) {
      consumables.push("Flask of Power", "Food buff");
    }
  } else {
    // Trash pack
    const pack = encounter as TrashPackStrategy;

    if (pack.dangerRating === "dangerous" || pack.dangerRating === "deadly") {
      consumables.push("Health potion", "Defensive cooldowns ready");
      warnings.push(`DANGER: ${pack.dangerRating.toUpperCase()} pack`);
    }

    for (const cc of pack.ccRecommendations) {
      assignments.push({
        role: "CC",
        task: `${cc.ccType} on ${cc.targetName} - ${cc.reason}`
      });
    }
  }

  return {
    buffs,
    assignments,
    consumables,
    warnings
  };
}

/**
 * Analyze group readiness for content
 */
export function analyzeGroupReadiness(
  composition: GroupComposition,
  content: BossMechanicInfo | DungeonLayout,
  avgItemLevel: number
): {
  ready: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check role composition
  if ('tankCount' in content) {
    const boss = content as BossMechanicInfo;

    if (composition.tanks < boss.tankCount) {
      issues.push(`Need ${boss.tankCount} tanks, have ${composition.tanks}`);
      score -= 30;
    }

    if (composition.healers < boss.healerCount) {
      issues.push(`Need ${boss.healerCount} healers, have ${composition.healers}`);
      score -= 20;
    }

    if (composition.dps < boss.dpsCount) {
      issues.push(`Need ${boss.dpsCount} DPS, have ${composition.dps}`);
      score -= 15;
    }
  }

  // Check item level (rough estimates for WoW 11.2)
  const recommendedIlvl: { [key: string]: number } = {
    "normal_dungeon": 450,
    "heroic_dungeon": 463,
    "mythic_dungeon": 476,
    "mythic_plus_10": 489,
    "normal_raid": 476,
    "heroic_raid": 489,
    "mythic_raid": 502
  };

  const requiredIlvl = recommendedIlvl["heroic_dungeon"] || 450;

  if (avgItemLevel < requiredIlvl - 20) {
    issues.push(`Item level too low: ${avgItemLevel} (need ${requiredIlvl})`);
    score -= 25;
  } else if (avgItemLevel < requiredIlvl) {
    recommendations.push(`Item level slightly low: ${avgItemLevel} (recommend ${requiredIlvl})`);
    score -= 10;
  }

  // Check composition balance
  if (composition.strengths.length < 2) {
    recommendations.push("Group lacks key utility - consider adding buffs/CC");
    score -= 5;
  }

  return {
    ready: score >= 60,
    score,
    issues,
    recommendations
  };
}

/**
 * Get affix-specific strategies for Mythic+
 */
export function getAffixStrategy(affixName: string): {
  name: string;
  description: string;
  counterplay: string[];
  dangerousEnemies: string[];
  routeAdjustments: string[];
} {
  const affixStrategies: { [key: string]: any } = {
    "Fortified": {
      name: "Fortified",
      description: "Non-boss enemies have 20% more health and deal 30% more damage",
      counterplay: [
        "Use AoE stuns and CC more liberally on trash",
        "Save defensive cooldowns for large pulls",
        "Interrupt and dispel priority targets"
      ],
      dangerousEnemies: ["Casters", "Healers", "Large packs"],
      routeAdjustments: ["Smaller, safer pulls", "Skip optional packs if possible"]
    },
    "Tyrannical": {
      name: "Tyrannical",
      description: "Boss enemies have 30% more health and deal 15% more damage",
      counterplay: [
        "Save Hero/Bloodlust for hardest boss",
        "Use all cooldowns on bosses",
        "Perfect boss mechanics execution required"
      ],
      dangerousEnemies: ["All bosses"],
      routeAdjustments: ["Rush through trash", "Save time for longer boss fights"]
    },
    "Sanguine": {
      name: "Sanguine",
      description: "Enemies leave healing pools on death",
      counterplay: [
        "Tank kites enemies out of pools",
        "Don't stand in enemy blood pools",
        "Kill enemies away from other mobs"
      ],
      dangerousEnemies: ["Melee-heavy packs"],
      routeAdjustments: ["Fight in open areas with room to kite"]
    },
    "Raging": {
      name: "Raging",
      description: "Enemies gain damage at low health",
      counterplay: [
        "Use defensive cooldowns when enemies enrage",
        "Kill enemies evenly in AoE packs",
        "Enrage dispels are valuable"
      ],
      dangerousEnemies: ["Large trash packs at low health"],
      routeAdjustments: ["Smaller pulls to manage enrage timing"]
    },
    "Bolstering": {
      name: "Bolstering",
      description: "Enemies buff nearby allies when they die",
      counterplay: [
        "Kill enemies evenly",
        "Avoid leaving one enemy alive",
        "Use execute abilities wisely"
      ],
      dangerousEnemies: ["Packs with mixed health pools"],
      routeAdjustments: ["Separate dangerous mobs from packs"]
    },
    "Bursting": {
      name: "Bursting",
      description: "Enemies explode when killed, stacking DoT on group",
      counterplay: [
        "Stagger kills to manage stacks",
        "Healers prepare for burst damage",
        "Use defensive cooldowns at high stacks"
      ],
      dangerousEnemies: ["Large AoE packs"],
      routeAdjustments: ["Smaller pulls to limit burst stacks"]
    }
  };

  return affixStrategies[affixName] || {
    name: affixName,
    description: "Unknown affix",
    counterplay: ["Research this affix"],
    dangerousEnemies: [],
    routeAdjustments: []
  };
}
