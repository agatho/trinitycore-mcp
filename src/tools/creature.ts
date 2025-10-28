/**
 * Creature/NPC MCP Tool
 *
 * Comprehensive creature and NPC data access for TrinityCore WoW 11.2
 * Provides bot AI with detailed creature information for target selection,
 * threat assessment, vendor interactions, and trainer identification.
 *
 * @module creature
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS - WoW 11.2 Retail
// ============================================================================

/**
 * Main creature template data structure
 * Mirrors TrinityCore's creature_template table and CreatureTemplate struct
 */
export interface CreatureTemplate {
  entry: number;
  name: string;
  femaleName?: string;
  subname?: string;
  titleAlt?: string;
  iconName?: string;

  // Identification & Credit
  killCredit1: number;
  killCredit2: number;

  // Expansion & Content
  requiredExpansion: number;
  vignetteId: number;

  // Combat & Stats
  faction: number;
  classification: number; // 0=Normal, 1=Elite, 2=Rare Elite, 3=Boss, 4=Rare
  dmgSchool: number;
  baseAttackTime: number;
  rangeAttackTime: number;
  baseVariance: number;
  rangeVariance: number;
  unitClass: number; // 1=Warrior, 2=Paladin, 4=Rogue, 8=Mage

  // Movement
  speedWalk: number;
  speedRun: number;
  scale: number;
  movementType: number; // 0=Idle, 1=Random, 2=Waypoint
  movementId: number;

  // Flags & Behavior
  unitFlags: number;
  unitFlags2: number;
  unitFlags3: number;
  npcFlags: string; // BigInt as string
  flagsExtra: number;

  // Type & Family
  type: number; // CreatureType enum
  family: number; // CreatureFamily enum (for beasts/pets)

  // Trainer & Vehicle
  trainerClass: number;
  vehicleId: number;

  // AI & Scripts
  aiName: string;
  scriptName: string;
  stringId?: string;

  // Widgets & UI
  widgetSetId: number;
  widgetSetUnitConditionId: number;

  // Misc
  regenHealth: boolean;
  racialLeader: boolean;
  experienceModifier: number;
  creatureImmunitiesId: number;
  verifiedBuild: number;
}

/**
 * Creature difficulty-specific stats
 * Scales based on dungeon/raid difficulty
 */
export interface CreatureDifficulty {
  entry: number;
  difficultyId: number; // 0=Normal, 1=Heroic, 2=Mythic, 23=Mythic+
  levelScalingDeltaMin: number;
  levelScalingDeltaMax: number;
  contentTuningId: number;
  healthScalingExpansion: number;

  // Stat Modifiers
  healthModifier: number;
  manaModifier: number;
  armorModifier: number;
  damageModifier: number;

  // Difficulty-specific attributes
  creatureDifficultyId: number;
  typeFlags: number;
  typeFlags2: number;
  typeFlags3: number;

  // Loot & Gold
  lootId: number;
  pickPocketLootId: number;
  skinLootId: number;
  goldMin: number;
  goldMax: number;

  // Static Flags (8 flag sets)
  staticFlags1: number;
  staticFlags2: number;
  staticFlags3: number;
  staticFlags4: number;
  staticFlags5: number;
  staticFlags6: number;
  staticFlags7: number;
  staticFlags8: number;

  verifiedBuild: number;
}

/**
 * Vendor item data
 */
export interface VendorItem {
  entry: number; // Creature entry
  slot: number;
  item: number; // Item ID
  maxCount: number; // 0 = unlimited
  incrTime: number; // Restock time in seconds
  extendedCost: number; // Extended cost ID
  type: number; // 1=Item, 2=Currency
  bonusListIds?: string;
  playerConditionId: number;
  ignoreFiltering: boolean;
}

/**
 * Trainer data
 */
export interface TrainerInfo {
  trainerId: number;
  type: number; // 0=Class, 1=Mount, 2=Tradeskill, 3=Pet
  greeting?: string;
  spells: TrainerSpell[];
}

/**
 * Spell taught by trainer
 */
export interface TrainerSpell {
  trainerId: number;
  spellId: number;
  moneyCost: number;
  reqSkillLine: number;
  reqSkillRank: number;
  reqAbility1: number;
  reqAbility2: number;
  reqAbility3: number;
  reqLevel: number;
}

/**
 * Loot entry for creature
 */
export interface LootEntry {
  entry: number; // Creature entry
  itemType: number; // 0=Item, 1=Currency, 2=Reference
  item: number;
  chance: number; // 0-100
  questRequired: boolean;
  lootMode: number;
  groupId: number;
  minCount: number;
  maxCount: number;
  comment?: string;
}

/**
 * Equipment template for creature visuals
 */
export interface CreatureEquipment {
  creatureId: number;
  id: number;
  itemId1: number;
  appearanceModId1: number;
  itemVisual1: number;
  itemId2: number;
  appearanceModId2: number;
  itemVisual2: number;
  itemId3: number;
  appearanceModId3: number;
  itemVisual3: number;
}

/**
 * Creature addon data (visual effects, auras)
 */
export interface CreatureAddon {
  entry: number;
  pathId: number;
  mount: number; // Display ID of mount
  mountCreatureId: number;
  standState: number;
  animTier: number;
  visFlags: number;
  sheathState: number;
  pvpFlags: number;
  emote: number;
  aiAnimKit: number;
  movementAnimKit: number;
  meleeAnimKit: number;
  visibilityDistanceType: number;
  auras?: string; // Space-separated aura IDs
}

/**
 * Complete creature information bundle
 */
export interface CreatureFullInfo {
  template: CreatureTemplate;
  difficulties: CreatureDifficulty[];
  addon?: CreatureAddon;
  equipment?: CreatureEquipment[];
  vendorItems?: VendorItem[];
  trainerInfo?: TrainerInfo;
  lootTable?: LootEntry[];

  // Computed values for bot AI
  analysis: {
    isBoss: boolean;
    isElite: boolean;
    isRare: boolean;
    isTameable: boolean;
    isVendor: boolean;
    isTrainer: boolean;
    hasLoot: boolean;
    threatLevel: "trivial" | "low" | "medium" | "high" | "extreme";
    estimatedHealth: number;
    estimatedDamage: number;
  };
}

/**
 * Search filters for creature queries
 */
export interface CreatureSearchFilters {
  name?: string; // Partial match
  type?: number; // CreatureType
  family?: number; // CreatureFamily
  classification?: number; // 0-4
  minLevel?: number;
  maxLevel?: number;
  faction?: number;
  isBoss?: boolean;
  isElite?: boolean;
  isVendor?: boolean;
  isTrainer?: boolean;
  expansion?: number;
  limit?: number;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get complete creature information by entry ID
 * Includes all related data: difficulties, vendor, trainer, loot, etc.
 */
export async function getCreatureFullInfo(
  entry: number,
  includeLoot: boolean = false
): Promise<CreatureFullInfo> {
  // Query main template
  const templateQuery = `
    SELECT
      entry, name, femaleName, subname, TitleAlt as titleAlt, IconName as iconName,
      KillCredit1 as killCredit1, KillCredit2 as killCredit2,
      RequiredExpansion as requiredExpansion, VignetteID as vignetteId,
      faction, Classification as classification, dmgschool as dmgSchool,
      BaseAttackTime as baseAttackTime, RangeAttackTime as rangeAttackTime,
      BaseVariance as baseVariance, RangeVariance as rangeVariance,
      unit_class as unitClass, unit_flags as unitFlags, unit_flags2 as unitFlags2,
      unit_flags3 as unitFlags3, npcflag as npcFlags, flags_extra as flagsExtra,
      type, family, trainer_class as trainerClass, VehicleId as vehicleId,
      AIName as aiName, ScriptName as scriptName, StringId as stringId,
      speed_walk as speedWalk, speed_run as speedRun, scale,
      MovementType as movementType, movementId,
      WidgetSetID as widgetSetId, WidgetSetUnitConditionID as widgetSetUnitConditionId,
      RegenHealth as regenHealth, RacialLeader as racialLeader,
      ExperienceModifier as experienceModifier, CreatureImmunitiesId as creatureImmunitiesId,
      VerifiedBuild as verifiedBuild
    FROM creature_template
    WHERE entry = ?
  `;

  const templates = await queryWorld(templateQuery, [entry]);

  if (!templates || templates.length === 0) {
    throw new Error(`Creature ${entry} not found`);
  }

  const template = templates[0] as CreatureTemplate;

  // Query difficulties
  const diffQuery = `
    SELECT
      Entry as entry, DifficultyID as difficultyId,
      LevelScalingDeltaMin as levelScalingDeltaMin,
      LevelScalingDeltaMax as levelScalingDeltaMax,
      ContentTuningID as contentTuningId,
      HealthScalingExpansion as healthScalingExpansion,
      HealthModifier as healthModifier, ManaModifier as manaModifier,
      ArmorModifier as armorModifier, DamageModifier as damageModifier,
      CreatureDifficultyID as creatureDifficultyId,
      TypeFlags as typeFlags, TypeFlags2 as typeFlags2, TypeFlags3 as typeFlags3,
      LootID as lootId, PickPocketLootID as pickPocketLootId, SkinLootID as skinLootId,
      GoldMin as goldMin, GoldMax as goldMax,
      StaticFlags1 as staticFlags1, StaticFlags2 as staticFlags2,
      StaticFlags3 as staticFlags3, StaticFlags4 as staticFlags4,
      StaticFlags5 as staticFlags5, StaticFlags6 as staticFlags6,
      StaticFlags7 as staticFlags7, StaticFlags8 as staticFlags8,
      VerifiedBuild as verifiedBuild
    FROM creature_template_difficulty
    WHERE Entry = ?
  `;

  const difficulties = await queryWorld(diffQuery, [entry]) as CreatureDifficulty[];

  // Query addon
  const addonQuery = `
    SELECT
      entry, PathId as pathId, mount, MountCreatureID as mountCreatureId,
      StandState as standState, AnimTier as animTier, VisFlags as visFlags,
      SheathState as sheathState, PvPFlags as pvpFlags, emote,
      aiAnimKit, movementAnimKit, meleeAnimKit,
      visibilityDistanceType, auras
    FROM creature_template_addon
    WHERE entry = ?
  `;

  const addons = await queryWorld(addonQuery, [entry]);
  const addon = addons && addons.length > 0 ? addons[0] as CreatureAddon : undefined;

  // Query equipment
  const equipQuery = `
    SELECT
      CreatureID as creatureId, ID as id,
      ItemID1 as itemId1, AppearanceModID1 as appearanceModId1, ItemVisual1 as itemVisual1,
      ItemID2 as itemId2, AppearanceModID2 as appearanceModId2, ItemVisual2 as itemVisual2,
      ItemID3 as itemId3, AppearanceModID3 as appearanceModId3, ItemVisual3 as itemVisual3
    FROM creature_equip_template
    WHERE CreatureID = ?
  `;

  const equipment = await queryWorld(equipQuery, [entry]) as CreatureEquipment[];

  // Check if vendor
  const vendorQuery = `
    SELECT
      entry, slot, item, maxcount as maxCount, incrtime as incrTime,
      ExtendedCost as extendedCost, type, BonusListIDs as bonusListIds,
      PlayerConditionID as playerConditionId, IgnoreFiltering as ignoreFiltering
    FROM npc_vendor
    WHERE entry = ?
    ORDER BY slot
  `;

  const vendorItems = await queryWorld(vendorQuery, [entry]) as VendorItem[];

  // Check if trainer
  let trainerInfo: TrainerInfo | undefined;
  const trainerLinkQuery = `
    SELECT TrainerID as trainerId
    FROM creature_trainer
    WHERE CreatureID = ?
    LIMIT 1
  `;

  const trainerLinks = await queryWorld(trainerLinkQuery, [entry]);

  if (trainerLinks && trainerLinks.length > 0) {
    const trainerId = trainerLinks[0].trainerId;

    const trainerQuery = `
      SELECT Id as trainerId, Type as type, Greeting as greeting
      FROM trainer
      WHERE Id = ?
    `;

    const trainers = await queryWorld(trainerQuery, [trainerId]);

    if (trainers && trainers.length > 0) {
      const trainerData = trainers[0];

      const spellsQuery = `
        SELECT
          TrainerId as trainerId, SpellId as spellId, MoneyCost as moneyCost,
          ReqSkillLine as reqSkillLine, ReqSkillRank as reqSkillRank,
          ReqAbility1 as reqAbility1, ReqAbility2 as reqAbility2, ReqAbility3 as reqAbility3,
          ReqLevel as reqLevel
        FROM trainer_spell
        WHERE TrainerId = ?
        ORDER BY ReqLevel, MoneyCost
      `;

      const spells = await queryWorld(spellsQuery, [trainerId]) as TrainerSpell[];

      trainerInfo = {
        trainerId: trainerData.trainerId,
        type: trainerData.type,
        greeting: trainerData.greeting,
        spells: spells || []
      };
    }
  }

  // Query loot (optional, can be large)
  let lootTable: LootEntry[] | undefined;

  if (includeLoot && difficulties.length > 0) {
    // Get loot IDs from difficulties
    const lootIds = difficulties
      .map(d => d.lootId)
      .filter(id => id > 0);

    if (lootIds.length > 0) {
      const lootQuery = `
        SELECT
          Entry as entry, ItemType as itemType, Item as item, Chance as chance,
          QuestRequired as questRequired, LootMode as lootMode, GroupId as groupId,
          MinCount as minCount, MaxCount as maxCount, Comment as comment
        FROM creature_loot_template
        WHERE Entry IN (${lootIds.join(',')})
        ORDER BY Chance DESC
        LIMIT 100
      `;

      lootTable = await queryWorld(lootQuery) as LootEntry[];
    }
  }

  // Compute analysis for bot AI
  const analysis = analyzeCreature(template, difficulties);

  return {
    template,
    difficulties,
    addon,
    equipment: equipment.length > 0 ? equipment : undefined,
    vendorItems: vendorItems.length > 0 ? vendorItems : undefined,
    trainerInfo,
    lootTable,
    analysis
  };
}

/**
 * Search for creatures matching filters
 */
export async function searchCreatures(
  filters: CreatureSearchFilters
): Promise<CreatureTemplate[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.name) {
    conditions.push("name LIKE ?");
    params.push(`%${filters.name}%`);
  }

  if (filters.type !== undefined) {
    conditions.push("type = ?");
    params.push(filters.type);
  }

  if (filters.family !== undefined) {
    conditions.push("family = ?");
    params.push(filters.family);
  }

  if (filters.classification !== undefined) {
    conditions.push("Classification = ?");
    params.push(filters.classification);
  }

  if (filters.faction !== undefined) {
    conditions.push("faction = ?");
    params.push(filters.faction);
  }

  if (filters.expansion !== undefined) {
    conditions.push("RequiredExpansion = ?");
    params.push(filters.expansion);
  }

  // Boss filter (classification = 3)
  if (filters.isBoss) {
    conditions.push("Classification = 3");
  }

  // Elite filter (classification IN (1, 2, 3))
  if (filters.isElite) {
    conditions.push("Classification IN (1, 2, 3)");
  }

  // Vendor filter (npcflag has vendor bit)
  if (filters.isVendor) {
    conditions.push("(npcflag & 128) != 0");
  }

  // Trainer filter (npcflag has trainer bit)
  if (filters.isTrainer) {
    conditions.push("(npcflag & 16) != 0");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 50;

  const query = `
    SELECT
      entry, name, subname, type, family, faction,
      Classification as classification, npcflag as npcFlags,
      RequiredExpansion as requiredExpansion, AIName as aiName,
      speed_walk as speedWalk, speed_run as speedRun,
      unit_class as unitClass, unit_flags as unitFlags
    FROM creature_template
    ${whereClause}
    ORDER BY entry
    LIMIT ${limit}
  `;

  return await queryWorld(query, params) as CreatureTemplate[];
}

/**
 * Get creatures by type
 */
export async function getCreaturesByType(
  creatureType: number,
  limit: number = 50
): Promise<CreatureTemplate[]> {
  return searchCreatures({ type: creatureType, limit });
}

/**
 * Get all vendors in the database
 */
export async function getAllVendors(limit: number = 100): Promise<CreatureTemplate[]> {
  return searchCreatures({ isVendor: true, limit });
}

/**
 * Get all trainers in the database
 */
export async function getAllTrainers(limit: number = 100): Promise<CreatureTemplate[]> {
  return searchCreatures({ isTrainer: true, limit });
}

/**
 * Get creatures by faction
 */
export async function getCreaturesByFaction(
  faction: number,
  limit: number = 100
): Promise<CreatureTemplate[]> {
  return searchCreatures({ faction, limit });
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze creature to provide bot AI insights
 */
function analyzeCreature(
  template: CreatureTemplate,
  difficulties: CreatureDifficulty[]
): CreatureFullInfo["analysis"] {
  const isBoss = template.classification === 3;
  const isElite = template.classification === 1 || template.classification === 2 || template.classification === 3;
  const isRare = template.classification === 2 || template.classification === 4;

  // Check tameable (type=1 Beast, family > 0)
  const isTameable = template.type === 1 && template.family > 0;

  // Check vendor (npcflag bit 7 = 128)
  const npcFlagNum = BigInt(template.npcFlags);
  const isVendor = (npcFlagNum & BigInt(128)) !== BigInt(0);

  // Check trainer (npcflag bit 4 = 16)
  const isTrainer = (npcFlagNum & BigInt(16)) !== BigInt(0);

  // Has loot if any difficulty has lootId > 0
  const hasLoot = difficulties.some(d => d.lootId > 0);

  // Threat level assessment
  let threatLevel: CreatureFullInfo["analysis"]["threatLevel"] = "medium";

  if (isBoss) {
    threatLevel = "extreme";
  } else if (isElite && isRare) {
    threatLevel = "high";
  } else if (isElite) {
    threatLevel = "high";
  } else if (isRare) {
    threatLevel = "medium";
  } else {
    threatLevel = "low";
  }

  // Estimate health (using healthModifier from normal difficulty)
  let estimatedHealth = 1000; // Base

  if (difficulties.length > 0) {
    const normalDiff = difficulties.find(d => d.difficultyId === 0) || difficulties[0];
    estimatedHealth = Math.round(1000 * normalDiff.healthModifier);
  }

  // Estimate damage (using damageModifier)
  let estimatedDamage = 50; // Base

  if (difficulties.length > 0) {
    const normalDiff = difficulties.find(d => d.difficultyId === 0) || difficulties[0];
    estimatedDamage = Math.round(50 * normalDiff.damageModifier);
  }

  return {
    isBoss,
    isElite,
    isRare,
    isTameable,
    isVendor,
    isTrainer,
    hasLoot,
    threatLevel,
    estimatedHealth,
    estimatedDamage
  };
}

/**
 * Get creature statistics for a zone or type
 */
export async function getCreatureStatistics(filters: {
  type?: number;
  faction?: number;
  expansion?: number;
}): Promise<{
  total: number;
  byClassification: { [key: number]: number };
  byType: { [key: number]: number };
  vendors: number;
  trainers: number;
  bosses: number;
}> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.type !== undefined) {
    conditions.push("type = ?");
    params.push(filters.type);
  }

  if (filters.faction !== undefined) {
    conditions.push("faction = ?");
    params.push(filters.faction);
  }

  if (filters.expansion !== undefined) {
    conditions.push("RequiredExpansion = ?");
    params.push(filters.expansion);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM creature_template
    ${whereClause}
  `;

  const countResult = await queryWorld(countQuery, params);
  const total = countResult[0].total;

  // Get classification breakdown
  const classQuery = `
    SELECT Classification, COUNT(*) as count
    FROM creature_template
    ${whereClause}
    GROUP BY Classification
  `;

  const classResults = await queryWorld(classQuery, params);
  const byClassification: { [key: number]: number } = {};

  for (const row of classResults) {
    byClassification[row.Classification] = row.count;
  }

  // Get type breakdown
  const typeQuery = `
    SELECT type, COUNT(*) as count
    FROM creature_template
    ${whereClause}
    GROUP BY type
  `;

  const typeResults = await queryWorld(typeQuery, params);
  const byType: { [key: number]: number } = {};

  for (const row of typeResults) {
    byType[row.type] = row.count;
  }

  // Get vendor count
  const vendorQuery = `
    SELECT COUNT(*) as count
    FROM creature_template
    ${whereClause}${whereClause ? " AND" : "WHERE"} (npcflag & 128) != 0
  `;

  const vendorResult = await queryWorld(vendorQuery, params);
  const vendors = vendorResult[0].count;

  // Get trainer count
  const trainerQuery = `
    SELECT COUNT(*) as count
    FROM creature_template
    ${whereClause}${whereClause ? " AND" : "WHERE"} (npcflag & 16) != 0
  `;

  const trainerResult = await queryWorld(trainerQuery, params);
  const trainers = trainerResult[0].count;

  // Get boss count
  const bossQuery = `
    SELECT COUNT(*) as count
    FROM creature_template
    ${whereClause}${whereClause ? " AND" : "WHERE"} Classification = 3
  `;

  const bossResult = await queryWorld(bossQuery, params);
  const bosses = bossResult[0].count;

  return {
    total,
    byClassification,
    byType,
    vendors,
    trainers,
    bosses
  };
}
