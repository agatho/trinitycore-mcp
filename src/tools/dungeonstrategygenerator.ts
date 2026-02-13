/**
 * Automatic Dungeon Strategy Generator
 *
 * Generates comprehensive dungeon strategies by analyzing live database data:
 * - Auto-discovers all creatures in a dungeon map
 * - Groups creatures into spatial "packs" via proximity clustering
 * - Analyzes creature abilities using spell cache data
 * - Identifies creature combat roles (caster, healer, melee, ranged)
 * - Generates CC targets, interrupt priorities, and pull orders
 * - Creates spatial routing for efficient clearing
 * - Provides per-pack and per-boss tactical recommendations
 *
 * @module tools/dungeonstrategygenerator
 */

import { queryWorld } from "../database/connection";
import { logger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import { JsonCacheLoader } from "../utils/json-cache-loader";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Raw creature spawn data from the database */
interface CreatureSpawnRow {
  guid: number;
  entry: number;
  map: number;
  position_x: number;
  position_y: number;
  position_z: number;
  orientation: number;
  spawntimesecs: number;
}

/** Creature template data from the database */
interface CreatureTemplateRow {
  entry: number;
  name: string;
  subname: string | null;
  HealthScalingExpansion: number;
  ContentTuningID: number;
  Classification: number; // 0=Normal, 1=Elite, 2=Rare Elite, 3=WorldBoss, 4=Rare
  CreatureType: number; // 1=Beast, 2=Dragonkin, 3=Demon, 4=Elemental, 5=Giant, 6=Undead, 7=Humanoid, 8=Critter, 9=Mechanical, 10=Not specified, 11=Totem, 12=Non-Combat Pet, 13=Gas Cloud, 14=Wild Pet, 15=Aberration
  family: number;
  UnitClass: number; // 1=Warrior, 2=Paladin, 4=Rogue, 8=Mage
  npcflag: number;
  MovementType: number;
  mechanic_immune_mask: number;
  flags_extra: number;
  ScriptName: string;
}

/** Creature difficulty data (health, damage, etc.) */
interface CreatureDifficultyRow {
  Entry: number;
  ContentTuningID: number;
  HealthScalingExpansion: number;
  DifficultyID: number;
  LevelScalingDeltaMin: number;
  LevelScalingDeltaMax: number;
  VerifiedBuild: number;
}

/** Creature spells from creature_template_spell or smart_scripts */
interface CreatureSpellInfo {
  entry: number;
  spellId: number;
  spellName: string;
  spellType: SpellCategory;
  castTime: number;
  isInterruptible: boolean;
  priority: "critical" | "high" | "medium" | "low";
}

/** Spell categories for combat analysis */
type SpellCategory =
  | "heal"
  | "damage_melee"
  | "damage_ranged"
  | "damage_aoe"
  | "cc"
  | "buff"
  | "debuff"
  | "summon"
  | "enrage"
  | "shield"
  | "unknown";

/** A spatially-grouped pack of creatures */
export interface CreaturePack {
  packId: number;
  centroidX: number;
  centroidY: number;
  centroidZ: number;
  creatures: PackCreature[];
  totalCount: number;
  eliteCount: number;
  hasBoss: boolean;
  difficulty: "trivial" | "easy" | "moderate" | "hard" | "deadly";
  difficultyScore: number;
  estimatedTimeSeconds: number;
  ccTargets: CCRecommendation[];
  interruptPriorities: InterruptTarget[];
  pullStrategy: string;
  warnings: string[];
  notes: string[];
}

/** A creature within a pack, enriched with combat role analysis */
export interface PackCreature {
  entry: number;
  name: string;
  count: number;
  classification: string;
  creatureType: string;
  combatRole: CombatRole;
  unitClass: string;
  dangerRating: number;
  abilities: CreatureSpellInfo[];
  immunities: string[];
  isPatrol: boolean;
  positions: Array<{ x: number; y: number; z: number }>;
}

/** Combat role classification */
type CombatRole =
  | "melee_dps"
  | "ranged_dps"
  | "caster"
  | "healer"
  | "tank"
  | "summoner"
  | "crowd_control"
  | "support"
  | "unknown";

/** CC recommendation for a pack */
export interface CCRecommendation {
  targetName: string;
  targetEntry: number;
  ccType: string;
  reason: string;
  priority: number;
}

/** Interrupt target for a pack */
export interface InterruptTarget {
  targetName: string;
  targetEntry: number;
  spellId: number;
  spellName: string;
  priority: "critical" | "high" | "medium";
  reason: string;
}

/** Boss encounter generated from database analysis */
export interface GeneratedBossEncounter {
  entry: number;
  name: string;
  packId: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  abilities: CreatureSpellInfo[];
  phases: GeneratedPhase[];
  tankStrategy: string;
  healerStrategy: string;
  dpsStrategy: string;
  interruptOrder: InterruptTarget[];
  estimatedDurationSeconds: number;
  difficultyRating: number;
  adds: PackCreature[];
  notes: string[];
}

/** Auto-generated encounter phase */
interface GeneratedPhase {
  phaseNumber: number;
  trigger: string;
  description: string;
  keyMechanics: string[];
  priority: "survival" | "dps" | "healing";
}

/** Complete auto-generated dungeon strategy */
export interface GeneratedDungeonStrategy {
  dungeonMapId: number;
  dungeonName: string;
  levelRange: { min: number; max: number };
  totalCreatures: number;
  totalPacks: number;
  bossCount: number;
  estimatedClearTimeMinutes: number;

  bosses: GeneratedBossEncounter[];
  trashPacks: CreaturePack[];
  pullOrder: PullOrderEntry[];
  route: RouteStep[];

  groupRecommendations: {
    minGroupSize: number;
    recommendedGroupSize: number;
    tankCount: number;
    healerCount: number;
    dpsCount: number;
    criticalUtility: string[];
  };

  summary: string;
  generatedAt: string;
  dataSource: string;
}

/** Pull order entry */
interface PullOrderEntry {
  order: number;
  packId: number;
  type: "trash" | "boss" | "optional";
  description: string;
  difficulty: string;
  estimatedTimeSeconds: number;
}

/** Route step between packs */
interface RouteStep {
  stepNumber: number;
  fromPackId: number | null;
  toPackId: number;
  distanceYards: number;
  description: string;
  patrolWarnings: string[];
}

// ============================================================================
// SPELL CACHE HELPERS
// ============================================================================

// Lazy-loaded spell name cache (replaces ~25 lines of duplicate boilerplate)
const spellNameCacheForStrategy = new JsonCacheLoader<string>("./data/cache/spell_names_cache.json", "spell name (strategy)");

function getSpellName(spellId: number): string {
  return spellNameCacheForStrategy.get(spellId) || `Spell ${spellId}`;
}

/**
 * Categorize a spell by its name heuristics.
 * In production this would use SpellEffect.db2 data; for now we use name pattern matching.
 */
function categorizeSpell(spellId: number, name: string): SpellCategory {
  const lower = name.toLowerCase();

  // Healing keywords (no trailing \b so stems like "rejuv" match "rejuvenation")
  if (/\b(heal|mend|rejuvenation|rejuv|renew|restoration|bandage|recovery|cure|soothe|nourish|regrowth|lifebloom)/.test(lower)) {
    return "heal";
  }

  // CC keywords
  if (/\b(stun|fear|sleep|poly|hex|root|freeze|entangle|shackle|seduc|charm|disorient|incapacit|knockback|knock back|silence)/.test(lower)) {
    return "cc";
  }

  // Shield/defensive
  if (/\b(shield|barrier|absorb|reflect|protect|ward|fortitude|divine shield|ice block)/.test(lower)) {
    return "shield";
  }

  // Enrage
  if (/\b(enrage|frenzy|berserk|rampage)/.test(lower)) {
    return "enrage";
  }

  // Summon
  if (/\b(summon|call|spawn|raise|animate)/.test(lower)) {
    return "summon";
  }

  // Buff
  if (/\b(buff|blessing|aura|empower|strengthen|haste|bloodlust|power word)/.test(lower)) {
    return "buff";
  }

  // Debuff
  if (/\b(curse|poison|disease|plague|corruption|dot|bleed|wither|decay|drain)/.test(lower)) {
    return "debuff";
  }

  // AoE damage
  if (/\b(nova|explosion|whirlwind|volley|rain|storm|blizzard|flamestrike|consecrat|earthquake|aoe|cleave|barrage|thunder)/.test(lower)) {
    return "damage_aoe";
  }

  // Ranged damage
  if (/\b(bolt|blast|shot|missile|arrow|fireball|frostbolt|shadow bolt|wrath|smite|lightning|arcane)/.test(lower)) {
    return "damage_ranged";
  }

  // Melee damage
  if (/\b(strike|slash|cleave|crush|bite|claw|maul|rend|pummel|charge|mortal)/.test(lower)) {
    return "damage_melee";
  }

  return "unknown";
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

const CLASSIFICATION_NAMES: Record<number, string> = {
  0: "Normal",
  1: "Elite",
  2: "Rare Elite",
  3: "Boss",
  4: "Rare",
};

const CREATURE_TYPE_NAMES: Record<number, string> = {
  0: "None",
  1: "Beast",
  2: "Dragonkin",
  3: "Demon",
  4: "Elemental",
  5: "Giant",
  6: "Undead",
  7: "Humanoid",
  8: "Critter",
  9: "Mechanical",
  10: "Not specified",
  11: "Totem",
  12: "Non-Combat Pet",
  13: "Gas Cloud",
  14: "Wild Pet",
  15: "Aberration",
};

const UNIT_CLASS_NAMES: Record<number, string> = {
  1: "Warrior",
  2: "Paladin",
  4: "Rogue",
  8: "Mage",
};

/**
 * Determine combat role from creature data
 */
function determineCombatRole(
  template: CreatureTemplateRow,
  spells: CreatureSpellInfo[]
): CombatRole {
  const hasHeal = spells.some((s) => s.spellType === "heal");
  const hasSummon = spells.some((s) => s.spellType === "summon");
  const hasCC = spells.some((s) => s.spellType === "cc");
  const hasBuff = spells.some((s) => s.spellType === "buff");
  const hasRangedDamage = spells.some(
    (s) => s.spellType === "damage_ranged" || s.spellType === "damage_aoe"
  );

  // UnitClass 8 = Mage (caster)
  if (template.UnitClass === 8) {
    if (hasHeal) return "healer";
    return "caster";
  }

  // UnitClass 2 = Paladin (can be healer or tank)
  if (template.UnitClass === 2) {
    if (hasHeal) return "healer";
    return "tank";
  }

  // Spell-based detection
  if (hasHeal) return "healer";
  if (hasSummon) return "summoner";
  if (hasCC) return "crowd_control";
  if (hasBuff && !hasRangedDamage) return "support";
  if (hasRangedDamage) return "ranged_dps";

  // Default: melee
  return "melee_dps";
}

/**
 * Parse mechanic_immune_mask into human-readable immunities
 */
function parseImmunities(mask: number): string[] {
  const immunities: string[] = [];
  const MECHANICS: Record<number, string> = {
    1: "Charm",
    2: "Disorient",
    3: "Disarm",
    4: "Distract",
    5: "Fear",
    6: "Grip",
    7: "Root",
    8: "Slow",
    9: "Silence",
    10: "Sleep",
    11: "Snare",
    12: "Stun",
    13: "Freeze",
    14: "Knockout",
    15: "Bleed",
    16: "Bandage",
    17: "Polymorph",
    18: "Banish",
    19: "Shield",
    20: "Shackle",
    21: "Mount",
    22: "Infected",
    23: "Turn",
    24: "Horror",
    25: "Invulnerable",
    26: "Interrupt",
    27: "Daze",
    28: "Discovery",
    29: "Immune Shield",
    30: "Sap",
    31: "Enrage",
  };

  for (let i = 0; i < 32; i++) {
    if (mask & (1 << i)) {
      immunities.push(MECHANICS[i + 1] || `Mechanic${i + 1}`);
    }
  }
  return immunities;
}

/**
 * Calculate danger rating for a creature (0-100)
 */
function calculateDangerRating(
  template: CreatureTemplateRow,
  spells: CreatureSpellInfo[]
): number {
  let rating = 0;

  // Classification bonus
  if (template.Classification === 3) rating += 80; // Boss
  else if (template.Classification === 1) rating += 40; // Elite
  else if (template.Classification === 2) rating += 50; // Rare Elite
  else if (template.Classification === 4) rating += 30; // Rare

  // Spell-based rating
  const healSpells = spells.filter((s) => s.spellType === "heal");
  const ccSpells = spells.filter((s) => s.spellType === "cc");
  const aoeSpells = spells.filter((s) => s.spellType === "damage_aoe");
  const enrageSpells = spells.filter((s) => s.spellType === "enrage");
  const summonSpells = spells.filter((s) => s.spellType === "summon");

  rating += healSpells.length * 15;
  rating += ccSpells.length * 10;
  rating += aoeSpells.length * 8;
  rating += enrageSpells.length * 12;
  rating += summonSpells.length * 10;

  // Immunity bonus (highly immune = more dangerous)
  const immunities = parseImmunities(template.mechanic_immune_mask);
  rating += Math.min(immunities.length * 3, 20);

  return Math.min(rating, 100);
}

// ============================================================================
// SPATIAL CLUSTERING
// ============================================================================

/**
 * DBSCAN-style proximity clustering of creature positions.
 * Groups creatures within `radius` yards of each other into packs.
 */
function clusterCreatures(
  spawns: Array<{
    entry: number;
    x: number;
    y: number;
    z: number;
    guid: number;
  }>,
  radius: number = 30
): Array<Array<{ entry: number; x: number; y: number; z: number; guid: number }>> {
  const visited = new Set<number>();
  const clusters: Array<Array<typeof spawns[0]>> = [];

  for (const spawn of spawns) {
    if (visited.has(spawn.guid)) continue;

    // Start new cluster
    const cluster: Array<typeof spawns[0]> = [];
    const queue = [spawn];
    visited.add(spawn.guid);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      // Find neighbors within radius
      for (const other of spawns) {
        if (visited.has(other.guid)) continue;

        const dx = current.x - other.x;
        const dy = current.y - other.y;
        const dz = current.z - other.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist <= radius) {
          visited.add(other.guid);
          queue.push(other);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Calculate centroid of a cluster
 */
function clusterCentroid(
  cluster: Array<{ x: number; y: number; z: number }>
): { x: number; y: number; z: number } {
  const n = cluster.length;
  return {
    x: cluster.reduce((s, c) => s + c.x, 0) / n,
    y: cluster.reduce((s, c) => s + c.y, 0) / n,
    z: cluster.reduce((s, c) => s + c.z, 0) / n,
  };
}

/**
 * Euclidean distance between two 3D points
 */
function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ============================================================================
// MAIN STRATEGY GENERATOR
// ============================================================================

/**
 * Generate a comprehensive dungeon strategy from live database data.
 *
 * @param params.dungeonMapId - Map ID of the dungeon/instance
 * @param params.groupLevel - Average group level (for difficulty scaling)
 * @param params.groupSize - Number of players in the group (default: 5)
 * @param params.packRadius - Proximity radius for grouping creatures into packs (default: 30)
 * @returns Complete auto-generated dungeon strategy
 */
export async function generateDungeonStrategy(params: {
  dungeonMapId: number;
  groupLevel?: number;
  groupSize?: number;
  packRadius?: number;
}): Promise<GeneratedDungeonStrategy> {
  const { dungeonMapId, groupLevel = 90, groupSize = 5, packRadius = 30 } = params;

  logger.info(`Generating dungeon strategy for map ${dungeonMapId}`);

  // ---- Step 1: Get dungeon metadata ----
  const instanceData = await queryWorld(
    `SELECT map, levelMin, levelMax FROM instance_template WHERE map = ?`,
    [dungeonMapId]
  );

  let dungeonName = `Dungeon (Map ${dungeonMapId})`;
  let levelRange = { min: 1, max: 90 };

  if (instanceData && instanceData.length > 0) {
    levelRange = {
      min: instanceData[0].levelMin || 1,
      max: instanceData[0].levelMax || 90,
    };
  }

  // Try to get the map name from the Map table/data
  try {
    const mapNameResult = await queryWorld(
      `SELECT name FROM instance_template_locale WHERE map = ? AND locale = 'enUS' LIMIT 1`,
      [dungeonMapId]
    );
    if (mapNameResult && mapNameResult.length > 0 && mapNameResult[0].name) {
      dungeonName = mapNameResult[0].name;
    }
  } catch {
    // Locale table may not exist, that's fine
  }

  // ---- Step 2: Get ALL creature spawns in this dungeon ----
  const spawns: CreatureSpawnRow[] = await queryWorld(
    `SELECT guid, id as entry, map, position_x, position_y, position_z, orientation, spawntimesecs
     FROM creature
     WHERE map = ?`,
    [dungeonMapId]
  );

  if (!spawns || spawns.length === 0) {
    return {
      dungeonMapId,
      dungeonName,
      levelRange,
      totalCreatures: 0,
      totalPacks: 0,
      bossCount: 0,
      estimatedClearTimeMinutes: 0,
      bosses: [],
      trashPacks: [],
      pullOrder: [],
      route: [],
      groupRecommendations: {
        minGroupSize: 1,
        recommendedGroupSize: 5,
        tankCount: 1,
        healerCount: 1,
        dpsCount: 3,
        criticalUtility: [],
      },
      summary: `No creatures found in dungeon map ${dungeonMapId}.`,
      generatedAt: new Date().toISOString(),
      dataSource: "TrinityCore world database",
    };
  }

  // ---- Step 3: Get unique creature entries and their templates ----
  const uniqueEntries = [...new Set(spawns.map((s) => s.entry))];

  const templates = new Map<number, CreatureTemplateRow>();
  const creatureSpells = new Map<number, CreatureSpellInfo[]>();

  // Batch query creature templates
  if (uniqueEntries.length > 0) {
    const placeholders = uniqueEntries.map(() => "?").join(",");
    const templateRows: CreatureTemplateRow[] = await queryWorld(
      `SELECT entry, name, subname, HealthScalingExpansion, ContentTuningID,
              Classification, CreatureType, family, UnitClass, npcflag,
              MovementType, mechanic_immune_mask, flags_extra, ScriptName
       FROM creature_template
       WHERE entry IN (${placeholders})`,
      uniqueEntries
    );

    for (const row of templateRows) {
      templates.set(row.entry, row);
    }

    // Get creature spells from smart_scripts (EventType=0 = Combat, ActionType=11 = Cast Spell)
    try {
      const smartScriptSpells = await queryWorld(
        `SELECT entryorguid as entry, action_param1 as spellId
         FROM smart_scripts
         WHERE entryorguid IN (${placeholders})
           AND source_type = 0
           AND action_type = 11
           AND action_param1 > 0`,
        uniqueEntries
      );

      for (const row of smartScriptSpells) {
        const entry = row.entry as number;
        const spellId = row.spellId as number;
        const name = getSpellName(spellId);
        const spellType = categorizeSpell(spellId, name);

        const isInterruptible = spellType === "heal" || spellType === "damage_ranged" || spellType === "damage_aoe" || spellType === "cc";
        let priority: "critical" | "high" | "medium" | "low" = "low";
        if (spellType === "heal") priority = "critical";
        else if (spellType === "cc" || spellType === "enrage") priority = "high";
        else if (spellType === "damage_aoe" || spellType === "damage_ranged" || spellType === "summon") priority = "medium";

        if (!creatureSpells.has(entry)) {
          creatureSpells.set(entry, []);
        }
        creatureSpells.get(entry)!.push({
          entry,
          spellId,
          spellName: name,
          spellType,
          castTime: 0, // Would need Spell.db2 for cast time
          isInterruptible,
          priority,
        });
      }
    } catch (e) {
      logger.warn(`Could not query smart_scripts for dungeon spells: ${e}`);
    }
  }

  // ---- Step 4: Filter out non-combatant creatures ----
  const combatantSpawns = spawns.filter((s) => {
    const template = templates.get(s.entry);
    if (!template) return false;

    // Exclude critters (type 8), non-combat pets (type 12), gas clouds (type 13)
    if ([8, 12, 13].includes(template.CreatureType)) return false;

    // Exclude NPCs with vendor/trainer/flightmaster flags
    const NPC_FLAGS_NON_COMBAT = 0x1 | 0x2 | 0x10 | 0x20 | 0x80 | 0x100 | 0x200 | 0x2000;
    if (template.npcflag & NPC_FLAGS_NON_COMBAT) return false;

    return true;
  });

  // ---- Step 5: Cluster creatures into packs ----
  const spawnPoints = combatantSpawns.map((s) => ({
    entry: s.entry,
    x: s.position_x,
    y: s.position_y,
    z: s.position_z,
    guid: s.guid,
  }));

  const clusters = clusterCreatures(spawnPoints, packRadius);

  // ---- Step 6: Build enriched packs ----
  const packs: CreaturePack[] = [];
  const bossEncounters: GeneratedBossEncounter[] = [];
  let packIdCounter = 1;

  for (const cluster of clusters) {
    // Group creatures by entry within this cluster
    const entryMap = new Map<number, Array<{ x: number; y: number; z: number }>>();
    for (const point of cluster) {
      if (!entryMap.has(point.entry)) {
        entryMap.set(point.entry, []);
      }
      entryMap.get(point.entry)!.push({ x: point.x, y: point.y, z: point.z });
    }

    const centroid = clusterCentroid(cluster);
    const packId = packIdCounter++;

    const packCreatures: PackCreature[] = [];
    let hasBoss = false;
    let eliteCount = 0;
    let maxDanger = 0;

    for (const [entry, positions] of entryMap) {
      const template = templates.get(entry);
      if (!template) continue;

      const spells = creatureSpells.get(entry) || [];
      const role = determineCombatRole(template, spells);
      const danger = calculateDangerRating(template, spells);
      const immunities = parseImmunities(template.mechanic_immune_mask);
      const isPatrol = template.MovementType === 1;

      if (template.Classification === 3) hasBoss = true;
      if (template.Classification === 1 || template.Classification === 2) eliteCount += positions.length;
      maxDanger = Math.max(maxDanger, danger);

      packCreatures.push({
        entry,
        name: template.name,
        count: positions.length,
        classification: CLASSIFICATION_NAMES[template.Classification] || "Normal",
        creatureType: CREATURE_TYPE_NAMES[template.CreatureType] || "Unknown",
        combatRole: role,
        unitClass: UNIT_CLASS_NAMES[template.UnitClass] || "Warrior",
        dangerRating: danger,
        abilities: spells,
        immunities,
        isPatrol,
        positions,
      });
    }

    // Sort creatures by danger rating descending
    packCreatures.sort((a, b) => b.dangerRating - a.dangerRating);

    // Calculate pack difficulty
    const totalCount = packCreatures.reduce((s, c) => s + c.count, 0);
    const difficultyScore = calculatePackDifficulty(packCreatures, totalCount, eliteCount, hasBoss);
    const difficulty = scoreToDifficulty(difficultyScore);

    // Generate CC recommendations
    const ccTargets = generateCCRecommendations(packCreatures);

    // Generate interrupt priorities
    const interruptPriorities = generateInterruptPriorities(packCreatures);

    // Generate pull strategy
    const pullStrategy = generatePullStrategy(packCreatures, difficulty, ccTargets);

    // Warnings
    const warnings = generatePackWarnings(packCreatures);

    // Notes
    const notes = generatePackNotes(packCreatures);

    // Estimated time
    const estimatedTimeSeconds = estimatePackClearTime(totalCount, eliteCount, hasBoss, difficultyScore);

    const pack: CreaturePack = {
      packId,
      centroidX: centroid.x,
      centroidY: centroid.y,
      centroidZ: centroid.z,
      creatures: packCreatures,
      totalCount,
      eliteCount,
      hasBoss,
      difficulty,
      difficultyScore,
      estimatedTimeSeconds,
      ccTargets,
      interruptPriorities,
      pullStrategy,
      warnings,
      notes,
    };

    packs.push(pack);

    // If this pack has a boss, generate a boss encounter
    if (hasBoss) {
      const bossCreatures = packCreatures.filter((c) => c.classification === "Boss");
      const addCreatures = packCreatures.filter((c) => c.classification !== "Boss");

      for (const bossCreature of bossCreatures) {
        bossEncounters.push(
          generateBossEncounter(bossCreature, addCreatures, pack, packId)
        );
      }
    }
  }

  // ---- Step 7: Generate pull order (nearest-neighbor route) ----
  const pullOrder = generatePullOrder(packs);

  // ---- Step 8: Generate spatial route ----
  const route = generateRoute(packs, pullOrder);

  // ---- Step 9: Calculate group recommendations ----
  const groupRecommendations = generateGroupRecommendations(packs, bossEncounters);

  // ---- Step 10: Estimate total clear time ----
  const totalClearSeconds = packs.reduce((s, p) => s + p.estimatedTimeSeconds, 0)
    + route.reduce((s, r) => s + r.distanceYards / 7, 0); // ~7 yards/sec movement

  // ---- Step 11: Generate summary ----
  const summary = generateSummary(
    dungeonName,
    dungeonMapId,
    packs,
    bossEncounters,
    totalClearSeconds,
    groupRecommendations
  );

  return {
    dungeonMapId,
    dungeonName,
    levelRange,
    totalCreatures: combatantSpawns.length,
    totalPacks: packs.length,
    bossCount: bossEncounters.length,
    estimatedClearTimeMinutes: Math.round(totalClearSeconds / 60),
    bosses: bossEncounters,
    trashPacks: packs.filter((p) => !p.hasBoss),
    pullOrder,
    route,
    groupRecommendations,
    summary,
    generatedAt: new Date().toISOString(),
    dataSource: "TrinityCore world database + spell cache + smart_scripts",
  };
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

function calculatePackDifficulty(
  creatures: PackCreature[],
  totalCount: number,
  eliteCount: number,
  hasBoss: boolean
): number {
  let score = 0;

  // Base score from count
  score += Math.min(totalCount * 5, 30);

  // Elite bonus
  score += eliteCount * 15;

  // Boss bonus
  if (hasBoss) score += 40;

  // Average danger bonus
  const avgDanger = creatures.reduce((s, c) => s + c.dangerRating * c.count, 0) / Math.max(totalCount, 1);
  score += avgDanger * 0.3;

  // Healer presence bonus (much harder if healers)
  const hasHealer = creatures.some((c) => c.combatRole === "healer");
  if (hasHealer) score += 15;

  // Caster presence bonus
  const casterCount = creatures.filter((c) => c.combatRole === "caster" || c.combatRole === "ranged_dps").length;
  score += casterCount * 5;

  return Math.min(Math.round(score), 100);
}

function scoreToDifficulty(score: number): CreaturePack["difficulty"] {
  if (score >= 80) return "deadly";
  if (score >= 60) return "hard";
  if (score >= 40) return "moderate";
  if (score >= 20) return "easy";
  return "trivial";
}

function generateCCRecommendations(creatures: PackCreature[]): CCRecommendation[] {
  const recommendations: CCRecommendation[] = [];

  for (const creature of creatures) {
    // Healers must be CCd
    if (creature.combatRole === "healer") {
      const isPolyImmune = creature.immunities.includes("Polymorph");
      const isFearImmune = creature.immunities.includes("Fear");
      const isStunImmune = creature.immunities.includes("Stun");

      let ccType = "Polymorph";
      if (isPolyImmune && !isFearImmune) ccType = "Fear";
      else if (isPolyImmune && !isStunImmune) ccType = "Stun";
      else if (isPolyImmune) ccType = "Interrupt rotation";

      recommendations.push({
        targetName: creature.name,
        targetEntry: creature.entry,
        ccType,
        reason: "Has healing abilities - must be controlled or interrupted",
        priority: 10,
      });
    }

    // Casters should be CCd or interrupted
    if (creature.combatRole === "caster" && creature.dangerRating >= 30) {
      recommendations.push({
        targetName: creature.name,
        targetEntry: creature.entry,
        ccType: creature.immunities.includes("Polymorph") ? "Hex/Stun" : "Polymorph",
        reason: "Dangerous caster - CC to reduce incoming damage",
        priority: 7,
      });
    }

    // Summoners should be CCd
    if (creature.combatRole === "summoner") {
      recommendations.push({
        targetName: creature.name,
        targetEntry: creature.entry,
        ccType: "Any CC",
        reason: "Summons additional enemies - CC to prevent add spawns",
        priority: 8,
      });
    }
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

function generateInterruptPriorities(creatures: PackCreature[]): InterruptTarget[] {
  const priorities: InterruptTarget[] = [];

  for (const creature of creatures) {
    for (const spell of creature.abilities) {
      if (!spell.isInterruptible) continue;
      if (spell.priority === "low") continue;

      priorities.push({
        targetName: creature.name,
        targetEntry: creature.entry,
        spellId: spell.spellId,
        spellName: spell.spellName,
        priority: spell.priority as "critical" | "high" | "medium",
        reason:
          spell.spellType === "heal"
            ? "Healing spell - must interrupt"
            : spell.spellType === "cc"
            ? "Crowd control spell - interrupt to prevent"
            : spell.spellType === "damage_aoe"
            ? "AoE damage - interrupt to reduce group damage"
            : `${spell.spellType} spell`,
      });
    }
  }

  return priorities.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generatePullStrategy(
  creatures: PackCreature[],
  difficulty: CreaturePack["difficulty"],
  ccTargets: CCRecommendation[]
): string {
  const parts: string[] = [];

  if (ccTargets.length > 0) {
    parts.push(`CC ${ccTargets.length} target(s) before pull: ${ccTargets.map((c) => c.targetName).join(", ")}`);
  }

  const hasPatrol = creatures.some((c) => c.isPatrol);
  if (hasPatrol) {
    parts.push("Wait for patrol to be in optimal position before pulling");
  }

  const totalCount = creatures.reduce((s, c) => s + c.count, 0);
  const elites = creatures.filter((c) => c.classification === "Elite" || c.classification === "Rare Elite");

  if (difficulty === "deadly" || difficulty === "hard") {
    parts.push("Use defensive cooldowns on pull");
    if (totalCount > 4) parts.push("Consider splitting the pack if possible");
  }

  if (elites.length > 0) {
    parts.push(`Focus fire on ${elites[0].name} first (${elites[0].classification})`);
  } else if (creatures.length > 1) {
    const mostDangerous = creatures[0]; // Already sorted by danger
    parts.push(`Focus fire on ${mostDangerous.name} first (highest threat)`);
  }

  if (totalCount > 5) {
    parts.push("AoE damage recommended for large pack");
  }

  return parts.join(". ") + ".";
}

function generatePackWarnings(creatures: PackCreature[]): string[] {
  const warnings: string[] = [];

  // Patrol warnings
  const patrols = creatures.filter((c) => c.isPatrol);
  if (patrols.length > 0) {
    warnings.push(`Patrol creature(s): ${patrols.map((c) => c.name).join(", ")} - watch positioning`);
  }

  // Enrage warnings
  for (const creature of creatures) {
    const enrageSpells = creature.abilities.filter((s) => s.spellType === "enrage");
    if (enrageSpells.length > 0) {
      warnings.push(`${creature.name} can enrage - save enrage dispel or defensive CDs`);
    }
  }

  // Immunity warnings
  for (const creature of creatures) {
    if (creature.immunities.length > 3) {
      warnings.push(`${creature.name} immune to: ${creature.immunities.slice(0, 5).join(", ")}${creature.immunities.length > 5 ? "..." : ""}`);
    }
  }

  // Summon warnings
  for (const creature of creatures) {
    const summonSpells = creature.abilities.filter((s) => s.spellType === "summon");
    if (summonSpells.length > 0) {
      warnings.push(`${creature.name} can summon adds - kill quickly`);
    }
  }

  return warnings;
}

function generatePackNotes(creatures: PackCreature[]): string[] {
  const notes: string[] = [];

  // Creature type composition
  const typeMap = new Map<string, number>();
  for (const c of creatures) {
    typeMap.set(c.creatureType, (typeMap.get(c.creatureType) || 0) + c.count);
  }
  if (typeMap.size > 1) {
    notes.push(`Mixed creature types: ${[...typeMap.entries()].map(([t, n]) => `${n}x ${t}`).join(", ")}`);
  }

  // Role composition
  const roleMap = new Map<string, number>();
  for (const c of creatures) {
    roleMap.set(c.combatRole, (roleMap.get(c.combatRole) || 0) + c.count);
  }
  const roles = [...roleMap.entries()].map(([r, n]) => `${n}x ${r}`).join(", ");
  notes.push(`Roles: ${roles}`);

  return notes;
}

function estimatePackClearTime(
  totalCount: number,
  eliteCount: number,
  hasBoss: boolean,
  difficultyScore: number
): number {
  if (hasBoss) return 180 + difficultyScore * 2; // 3-7 minutes for bosses
  const base = totalCount * 6; // 6 seconds per normal mob
  const eliteBonus = eliteCount * 15; // +15s per elite
  const difficultyMod = 1 + difficultyScore / 100;
  return Math.round((base + eliteBonus) * difficultyMod);
}

function generateBossEncounter(
  boss: PackCreature,
  adds: PackCreature[],
  pack: CreaturePack,
  packId: number
): GeneratedBossEncounter {
  const phases: GeneratedPhase[] = [];

  // Phase 1 always exists
  phases.push({
    phaseNumber: 1,
    trigger: "Combat start",
    description: `Engage ${boss.name}`,
    keyMechanics: boss.abilities.map((a) => `${a.spellName} (${a.spellType})`),
    priority: "dps",
  });

  // If boss has heal or enrage, add a phase transition
  const hasHeal = boss.abilities.some((a) => a.spellType === "heal");
  const hasEnrage = boss.abilities.some((a) => a.spellType === "enrage");
  const hasSummon = boss.abilities.some((a) => a.spellType === "summon");

  if (hasHeal) {
    phases.push({
      phaseNumber: 2,
      trigger: "Boss below 50% health",
      description: "Healing phase - boss may increase healing frequency",
      keyMechanics: ["Prioritize interrupts on healing spells", "Maximize DPS to push through"],
      priority: "dps",
    });
  }

  if (hasEnrage) {
    phases.push({
      phaseNumber: phases.length + 1,
      trigger: "Boss below 30% health",
      description: "Enrage phase - increased damage output",
      keyMechanics: ["Enrage dispel if available", "Use defensive cooldowns", "Burn phase - maximize DPS"],
      priority: "survival",
    });
  }

  if (hasSummon) {
    phases.push({
      phaseNumber: phases.length + 1,
      trigger: "Periodic add spawns",
      description: "Add management phase",
      keyMechanics: ["Kill adds quickly", "Tank picks up adds", "AoE adds, then return to boss"],
      priority: "survival",
    });
  }

  // Generate role-specific strategies
  const healSpells = boss.abilities.filter((a) => a.spellType === "heal");
  const aoeSpells = boss.abilities.filter((a) => a.spellType === "damage_aoe");
  const ccSpells = boss.abilities.filter((a) => a.spellType === "cc");

  const tankStrategy = [
    "Maintain aggro on boss",
    adds.length > 0 ? `Pick up ${adds.length} add type(s) when they spawn` : null,
    aoeSpells.length > 0 ? "Use active mitigation during AoE" : null,
    "Face boss away from group",
  ].filter(Boolean).join(". ") + ".";

  const healerStrategy = [
    "Focus healing on tank",
    aoeSpells.length > 0 ? "Be ready for group-wide damage from AoE abilities" : null,
    ccSpells.length > 0 ? "Dispel CC effects immediately" : null,
    "Save healing cooldowns for sub-30% if enrage present",
  ].filter(Boolean).join(". ") + ".";

  const dpsStrategy = [
    "Focus DPS on boss",
    healSpells.length > 0 ? `INTERRUPT ${healSpells.map((h) => h.spellName).join(", ")}` : null,
    adds.length > 0 ? "Switch to adds when they spawn" : null,
    "Avoid standing in harmful effects",
  ].filter(Boolean).join(". ") + ".";

  // Interrupt order
  const interruptOrder = pack.interruptPriorities.filter(
    (ip) => ip.targetEntry === boss.entry
  );

  return {
    entry: boss.entry,
    name: boss.name,
    packId,
    positionX: boss.positions[0]?.x || 0,
    positionY: boss.positions[0]?.y || 0,
    positionZ: boss.positions[0]?.z || 0,
    abilities: boss.abilities,
    phases,
    tankStrategy,
    healerStrategy,
    dpsStrategy,
    interruptOrder,
    estimatedDurationSeconds: 180 + boss.abilities.length * 30,
    difficultyRating: boss.dangerRating,
    adds: adds,
    notes: pack.warnings,
  };
}

function generatePullOrder(packs: CreaturePack[]): PullOrderEntry[] {
  if (packs.length === 0) return [];

  // Sort by nearest-neighbor starting from centroid closest to (0,0,0) or first spawn
  const remaining = [...packs];
  const ordered: CreaturePack[] = [];

  // Start from the pack closest to the dungeon entrance (lowest X typically)
  remaining.sort((a, b) => {
    const distA = Math.abs(a.centroidX) + Math.abs(a.centroidY);
    const distB = Math.abs(b.centroidX) + Math.abs(b.centroidY);
    return distA - distB;
  });

  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length > 0) {
    // Find nearest unvisited pack
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = distance3D(
        { x: current.centroidX, y: current.centroidY, z: current.centroidZ },
        { x: remaining[i].centroidX, y: remaining[i].centroidY, z: remaining[i].centroidZ }
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered.map((pack, idx) => ({
    order: idx + 1,
    packId: pack.packId,
    type: pack.hasBoss ? "boss" : pack.difficultyScore < 15 ? "optional" : "trash",
    description: pack.hasBoss
      ? `Boss: ${pack.creatures.find((c) => c.classification === "Boss")?.name || "Unknown"}`
      : `Trash pack (${pack.totalCount} creatures, ${pack.difficulty})`,
    difficulty: pack.difficulty,
    estimatedTimeSeconds: pack.estimatedTimeSeconds,
  }));
}

function generateRoute(packs: CreaturePack[], pullOrder: PullOrderEntry[]): RouteStep[] {
  const route: RouteStep[] = [];

  for (let i = 0; i < pullOrder.length; i++) {
    const currentPack = packs.find((p) => p.packId === pullOrder[i].packId)!;
    const prevPack = i > 0 ? packs.find((p) => p.packId === pullOrder[i - 1].packId)! : null;

    const dist = prevPack
      ? distance3D(
          { x: prevPack.centroidX, y: prevPack.centroidY, z: prevPack.centroidZ },
          { x: currentPack.centroidX, y: currentPack.centroidY, z: currentPack.centroidZ }
        )
      : 0;

    // Check for patrol warnings between packs
    const patrolWarnings: string[] = [];
    for (const pack of packs) {
      if (pack.packId === currentPack.packId) continue;
      const patrols = pack.creatures.filter((c) => c.isPatrol);
      if (patrols.length > 0) {
        const packDist = distance3D(
          { x: currentPack.centroidX, y: currentPack.centroidY, z: currentPack.centroidZ },
          { x: pack.centroidX, y: pack.centroidY, z: pack.centroidZ }
        );
        if (packDist < 50) {
          patrolWarnings.push(
            `Nearby patrol: ${patrols.map((p) => p.name).join(", ")} (~${Math.round(packDist)} yards away)`
          );
        }
      }
    }

    route.push({
      stepNumber: i + 1,
      fromPackId: prevPack ? pullOrder[i - 1].packId : null,
      toPackId: pullOrder[i].packId,
      distanceYards: Math.round(dist),
      description: pullOrder[i].description,
      patrolWarnings,
    });
  }

  return route;
}

function generateGroupRecommendations(
  packs: CreaturePack[],
  bosses: GeneratedBossEncounter[]
): GeneratedDungeonStrategy["groupRecommendations"] {
  const utility: Set<string> = new Set();

  // Check if interrupts are needed
  const totalInterrupts = packs.reduce((s, p) => s + p.interruptPriorities.length, 0);
  if (totalInterrupts > 5) {
    utility.add("Multiple interrupt sources (3+ interrupts)");
  }

  // Check if CC is needed
  const totalCC = packs.reduce((s, p) => s + p.ccTargets.length, 0);
  if (totalCC > 3) {
    utility.add("Crowd control (Polymorph, Hex, etc.)");
  }

  // Check if enrage dispel needed
  const hasEnrage = packs.some((p) =>
    p.creatures.some((c) => c.abilities.some((a) => a.spellType === "enrage"))
  );
  if (hasEnrage) {
    utility.add("Enrage dispel (Soothe, Tranquilizing Shot)");
  }

  // Check if purge/dispel needed
  const hasBuff = packs.some((p) =>
    p.creatures.some((c) => c.abilities.some((a) => a.spellType === "buff"))
  );
  if (hasBuff) {
    utility.add("Purge/Dispel Magic for enemy buffs");
  }

  // Check if AoE healing needed
  const highAoePacks = packs.filter((p) =>
    p.creatures.some((c) => c.abilities.some((a) => a.spellType === "damage_aoe"))
  );
  if (highAoePacks.length > 3) {
    utility.add("Strong AoE healing for frequent group damage");
  }

  const maxBossDifficulty = bosses.length > 0
    ? Math.max(...bosses.map((b) => b.difficultyRating))
    : 0;

  return {
    minGroupSize: maxBossDifficulty >= 70 ? 5 : 3,
    recommendedGroupSize: 5,
    tankCount: 1,
    healerCount: 1,
    dpsCount: 3,
    criticalUtility: [...utility],
  };
}

function generateSummary(
  name: string,
  mapId: number,
  packs: CreaturePack[],
  bosses: GeneratedBossEncounter[],
  totalClearSeconds: number,
  groupRecs: GeneratedDungeonStrategy["groupRecommendations"]
): string {
  const trashPacks = packs.filter((p) => !p.hasBoss);
  const hardPacks = trashPacks.filter((p) => p.difficulty === "hard" || p.difficulty === "deadly");
  const totalTrash = trashPacks.reduce((s, p) => s + p.totalCount, 0);
  const totalInterrupts = packs.reduce((s, p) => s + p.interruptPriorities.length, 0);
  const totalCC = packs.reduce((s, p) => s + p.ccTargets.length, 0);

  const lines = [
    `# ${name} (Map ${mapId}) - Auto-Generated Strategy`,
    ``,
    `## Overview`,
    `- **Bosses:** ${bosses.length}`,
    `- **Trash Packs:** ${trashPacks.length} (${totalTrash} creatures total)`,
    `- **Dangerous Packs:** ${hardPacks.length} require careful execution`,
    `- **Estimated Clear Time:** ~${Math.round(totalClearSeconds / 60)} minutes`,
    ``,
    `## Group Requirements`,
    `- **Composition:** ${groupRecs.tankCount}T / ${groupRecs.healerCount}H / ${groupRecs.dpsCount}D (${groupRecs.recommendedGroupSize}-player)`,
    `- **Interrupt Sources Needed:** ${totalInterrupts} interrupt targets across all packs`,
    `- **CC Targets:** ${totalCC} creatures should be crowd-controlled`,
  ];

  if (groupRecs.criticalUtility.length > 0) {
    lines.push(`- **Critical Utility:** ${groupRecs.criticalUtility.join("; ")}`);
  }

  if (bosses.length > 0) {
    lines.push(``, `## Boss Encounters`);
    for (const boss of bosses) {
      lines.push(
        `- **${boss.name}** (Entry ${boss.entry}): ${boss.phases.length} phase(s), ${boss.abilities.length} abilities, difficulty ${boss.difficultyRating}/100`
      );
    }
  }

  if (hardPacks.length > 0) {
    lines.push(``, `## Key Dangerous Packs`);
    for (const pack of hardPacks.slice(0, 5)) {
      lines.push(
        `- **Pack #${pack.packId}** (${pack.difficulty}): ${pack.creatures.map((c) => `${c.count}x ${c.name}`).join(", ")}`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Format a generated strategy as markdown for display.
 */
export function formatStrategyMarkdown(strategy: GeneratedDungeonStrategy): string {
  const lines: string[] = [strategy.summary, ""];

  // Detailed pull order
  lines.push("## Pull Order");
  for (const pull of strategy.pullOrder) {
    const icon = pull.type === "boss" ? "💀" : pull.type === "optional" ? "⚪" : "🔴";
    lines.push(
      `${pull.order}. ${icon} **${pull.description}** [${pull.difficulty}] ~${Math.round(pull.estimatedTimeSeconds / 60)}min`
    );
  }

  // Boss details
  if (strategy.bosses.length > 0) {
    lines.push("", "## Boss Details");
    for (const boss of strategy.bosses) {
      lines.push(``, `### ${boss.name} (Entry ${boss.entry})`);
      lines.push(`- **Difficulty:** ${boss.difficultyRating}/100`);
      lines.push(`- **Estimated Duration:** ~${Math.round(boss.estimatedDurationSeconds / 60)} min`);
      lines.push(`- **Tank:** ${boss.tankStrategy}`);
      lines.push(`- **Healer:** ${boss.healerStrategy}`);
      lines.push(`- **DPS:** ${boss.dpsStrategy}`);

      if (boss.interruptOrder.length > 0) {
        lines.push(`- **Interrupt Priority:**`);
        for (const interrupt of boss.interruptOrder) {
          lines.push(`  - [${interrupt.priority.toUpperCase()}] ${interrupt.spellName} - ${interrupt.reason}`);
        }
      }

      if (boss.phases.length > 1) {
        lines.push(`- **Phases:**`);
        for (const phase of boss.phases) {
          lines.push(`  - P${phase.phaseNumber} (${phase.trigger}): ${phase.description}`);
        }
      }

      if (boss.adds.length > 0) {
        lines.push(`- **Adds:** ${boss.adds.map((a) => `${a.count}x ${a.name}`).join(", ")}`);
      }
    }
  }

  // Dangerous trash packs
  const hardTrash = strategy.trashPacks.filter(
    (p) => p.difficulty === "hard" || p.difficulty === "deadly"
  );
  if (hardTrash.length > 0) {
    lines.push("", "## Dangerous Trash Packs");
    for (const pack of hardTrash) {
      lines.push(``, `### Pack #${pack.packId} [${pack.difficulty.toUpperCase()}]`);
      lines.push(`- **Creatures:** ${pack.creatures.map((c) => `${c.count}x ${c.name} (${c.combatRole})`).join(", ")}`);
      lines.push(`- **Strategy:** ${pack.pullStrategy}`);

      if (pack.ccTargets.length > 0) {
        lines.push(`- **CC Targets:**`);
        for (const cc of pack.ccTargets) {
          lines.push(`  - ${cc.targetName}: ${cc.ccType} - ${cc.reason}`);
        }
      }

      if (pack.interruptPriorities.length > 0) {
        lines.push(`- **Interrupts:**`);
        for (const int of pack.interruptPriorities) {
          lines.push(`  - [${int.priority.toUpperCase()}] ${int.spellName} on ${int.targetName}`);
        }
      }

      if (pack.warnings.length > 0) {
        lines.push(`- **Warnings:** ${pack.warnings.join("; ")}`);
      }
    }
  }

  lines.push("", `---`, `*Generated at ${strategy.generatedAt} from ${strategy.dataSource}*`);

  return lines.join("\n");
}
