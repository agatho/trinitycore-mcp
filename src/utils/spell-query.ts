/**
 * Shared Spell Data Query Abstraction for TrinityCore 12.0.1
 *
 * In TrinityCore 12.0.1, the old `spell_template` table was completely removed.
 * Spell data now comes from:
 *
 * 1. DB2 files: SpellName.db2, SpellEffect.db2, SpellMisc.db2, etc. (client data)
 * 2. World DB: `serverside_spell` + `serverside_spell_effect` (server-side overrides only)
 *
 * This module provides a unified interface for querying spell data from the correct
 * sources. All tools that previously queried `spell_template` should use this module.
 *
 * The `serverside_spell` table in the world database contains server-side spell
 * definitions with columns including:
 * - Id, DifficultyID, SpellName, SpellLevel, BaseLevel, MaxLevel
 * - RecoveryTime, CategoryRecoveryTime (cooldowns)
 * - SchoolMask, DmgClass, SpellFamilyName
 * - ProcFlags, ProcChance, ProcCharges
 * - CastingTimeIndex, DurationIndex, RangeIndex
 * - And many more (83 columns total)
 *
 * @module utils/spell-query
 */

import { queryWorld } from "../database/connection";
import { safeLimit } from "./sql-limit";
import { logger } from "./logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Spell data from serverside_spell table.
 * Contains the most commonly needed fields across all MCP tools.
 */
export interface ServerSpellData {
  /** Spell ID */
  id: number;
  /** Spell name */
  spellName: string;
  /** Spell level */
  spellLevel: number;
  /** Base level */
  baseLevel: number;
  /** Max level */
  maxLevel: number;
  /** Recovery time (cooldown) in ms */
  recoveryTime: number;
  /** Category recovery time in ms */
  categoryRecoveryTime: number;
  /** School mask (1=Physical, 2=Holy, 4=Fire, 8=Nature, 16=Frost, 32=Shadow, 64=Arcane) */
  schoolMask: number;
  /** Damage class (0=None, 1=Physical, 2=Magic) */
  dmgClass: number;
  /** Proc flags */
  procFlags: number;
  /** Proc chance percentage */
  procChance: number;
  /** Proc charges */
  procCharges: number;
  /** Max charges (from ChargeCategoryId system) */
  chargeCategoryId: number;
  /** Speed */
  speed: number;
  /** Stack amount */
  stackAmount: number;
  /** Casting time index */
  castingTimeIndex: number;
  /** Duration index */
  durationIndex: number;
  /** Range index */
  rangeIndex: number;
  /** Spell family name */
  spellFamilyName: number;
  /** Prevention type */
  preventionType: number;
  /** Category ID */
  categoryId: number;
  /** Start recovery category */
  startRecoveryCategory: number;
  /** Start recovery time */
  startRecoveryTime: number;
  /** Content tuning ID */
  contentTuningId: number;
  /** Mechanic type */
  mechanic: number;
  /** Dispel type */
  dispel: number;
  /** Equipped item class */
  equippedItemClass: number;
}

/**
 * Spell effect data from serverside_spell_effect table.
 */
export interface ServerSpellEffectData {
  /** Spell ID */
  spellID: number;
  /** Effect index (0, 1, 2, etc.) */
  effectIndex: number;
  /** Difficulty ID */
  difficultyID: number;
  /** Effect type */
  effect: number;
  /** Effect aura */
  effectAura: number;
}

/**
 * Combined spell + cooldown data used by cooldown-tracker
 */
export interface SpellCooldownData {
  spellId: number;
  spellName: string;
  cooldownDuration: number;
  categoryCooldown: number;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query a single spell by ID from the serverside_spell table.
 *
 * @param spellId - The spell ID to query
 * @returns ServerSpellData if found, null if not found
 */
export async function querySpellById(spellId: number): Promise<ServerSpellData | null> {
  try {
    const query = `
      SELECT
        Id as id,
        SpellName as spellName,
        SpellLevel as spellLevel,
        BaseLevel as baseLevel,
        MaxLevel as maxLevel,
        RecoveryTime as recoveryTime,
        CategoryRecoveryTime as categoryRecoveryTime,
        SchoolMask as schoolMask,
        DmgClass as dmgClass,
        ProcFlags as procFlags,
        ProcChance as procChance,
        ProcCharges as procCharges,
        ChargeCategoryId as chargeCategoryId,
        Speed as speed,
        StackAmount as stackAmount,
        CastingTimeIndex as castingTimeIndex,
        DurationIndex as durationIndex,
        RangeIndex as rangeIndex,
        SpellFamilyName as spellFamilyName,
        PreventionType as preventionType,
        CategoryId as categoryId,
        StartRecoveryCategory as startRecoveryCategory,
        StartRecoveryTime as startRecoveryTime,
        ContentTuningId as contentTuningId,
        Mechanic as mechanic,
        Dispel as dispel,
        EquippedItemClass as equippedItemClass
      FROM serverside_spell
      WHERE Id = ? AND DifficultyID = 0
      LIMIT 1
    `;
    const rows = await queryWorld(query, [spellId]);
    if (!rows || rows.length === 0) {
      return null;
    }
    return mapRowToSpellData(rows[0]);
  } catch (error) {
    logger.warn(`[spell-query] Failed to query spell ${spellId}:`,
      error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Query spell name by ID from serverside_spell.
 * Lightweight query returning just the name.
 *
 * @param spellId - The spell ID to query
 * @returns Spell name string, or null if not found
 */
export async function querySpellName(spellId: number): Promise<string | null> {
  try {
    const query = `
      SELECT SpellName as spellName
      FROM serverside_spell
      WHERE Id = ? AND DifficultyID = 0
      LIMIT 1
    `;
    const rows = await queryWorld(query, [spellId]);
    if (!rows || rows.length === 0) {
      return null;
    }
    return rows[0].spellName || null;
  } catch (error) {
    logger.warn(`[spell-query] Failed to query spell name for ${spellId}:`,
      error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Query all spells with cooldowns from serverside_spell.
 * Replaces old spell_template cooldown queries.
 *
 * @returns Array of SpellCooldownData for spells that have cooldowns
 */
export async function querySpellCooldowns(): Promise<SpellCooldownData[]> {
  try {
    const query = `
      SELECT
        Id as spellId,
        SpellName as spellName,
        RecoveryTime as cooldownDuration,
        CategoryRecoveryTime as categoryCooldown
      FROM serverside_spell
      WHERE (RecoveryTime > 0 OR CategoryRecoveryTime > 0)
        AND DifficultyID = 0
      ORDER BY Id
    `;
    const rows = await queryWorld(query);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map((row: any) => ({
      spellId: row.spellId || 0,
      spellName: row.spellName || `Spell ${row.spellId}`,
      cooldownDuration: row.cooldownDuration || 0,
      categoryCooldown: row.categoryCooldown || 0,
    }));
  } catch (error) {
    logger.warn(`[spell-query] Failed to query spell cooldowns:`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Query spell effects for a given spell from serverside_spell_effect.
 *
 * @param spellId - The spell ID to query effects for
 * @returns Array of spell effect data
 */
export async function querySpellEffects(spellId: number): Promise<ServerSpellEffectData[]> {
  try {
    const query = `
      SELECT
        SpellID as spellID,
        EffectIndex as effectIndex,
        DifficultyID as difficultyID,
        Effect as effect,
        EffectAura as effectAura
      FROM serverside_spell_effect
      WHERE SpellID = ? AND DifficultyID = 0
      ORDER BY EffectIndex
    `;
    const rows = await queryWorld(query, [spellId]);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map((row: any) => ({
      spellID: row.spellID || 0,
      effectIndex: row.effectIndex || 0,
      difficultyID: row.difficultyID || 0,
      effect: row.effect || 0,
      effectAura: row.effectAura || 0,
    }));
  } catch (error) {
    logger.warn(`[spell-query] Failed to query spell effects for ${spellId}:`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Search spells by name pattern from serverside_spell.
 *
 * @param namePattern - SQL LIKE pattern (e.g., "%fireball%")
 * @param limit - Maximum results (default 50)
 * @returns Array of matching ServerSpellData
 */
export async function searchSpellsByName(namePattern: string, limit: number = 50): Promise<ServerSpellData[]> {
  try {
    const query = `
      SELECT
        Id as id,
        SpellName as spellName,
        SpellLevel as spellLevel,
        BaseLevel as baseLevel,
        MaxLevel as maxLevel,
        RecoveryTime as recoveryTime,
        CategoryRecoveryTime as categoryRecoveryTime,
        SchoolMask as schoolMask,
        DmgClass as dmgClass,
        ProcFlags as procFlags,
        ProcChance as procChance,
        ProcCharges as procCharges,
        ChargeCategoryId as chargeCategoryId,
        Speed as speed,
        StackAmount as stackAmount,
        CastingTimeIndex as castingTimeIndex,
        DurationIndex as durationIndex,
        RangeIndex as rangeIndex,
        SpellFamilyName as spellFamilyName,
        PreventionType as preventionType,
        CategoryId as categoryId,
        StartRecoveryCategory as startRecoveryCategory,
        StartRecoveryTime as startRecoveryTime,
        ContentTuningId as contentTuningId,
        Mechanic as mechanic,
        Dispel as dispel,
        EquippedItemClass as equippedItemClass
      FROM serverside_spell
      WHERE SpellName LIKE ? AND DifficultyID = 0
      ORDER BY Id ASC
      LIMIT ${safeLimit(limit)}
    `;
    const rows = await queryWorld(query, [namePattern]);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map(mapRowToSpellData);
  } catch (error) {
    logger.warn(`[spell-query] Failed to search spells by name "${namePattern}":`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Query spells by effect type from serverside_spell_effect.
 * Replaces old queries like: SELECT id FROM spell_template WHERE effect_1 = ?
 *
 * @param effectType - The spell effect type ID to search for
 * @param limit - Maximum results (default 100)
 * @returns Array of spell IDs that have the given effect
 */
export async function querySpellsByEffect(effectType: number, limit: number = 100): Promise<number[]> {
  try {
    const query = `
      SELECT DISTINCT SpellID as spellId
      FROM serverside_spell_effect
      WHERE Effect = ? AND DifficultyID = 0
      ORDER BY SpellID ASC
      LIMIT ${safeLimit(limit)}
    `;
    const rows = await queryWorld(query, [effectType]);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map((row: any) => row.spellId);
  } catch (error) {
    logger.warn(`[spell-query] Failed to query spells by effect ${effectType}:`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Map a database row to ServerSpellData
 */
function mapRowToSpellData(row: any): ServerSpellData {
  return {
    id: row.id || 0,
    spellName: row.spellName || '',
    spellLevel: row.spellLevel || 0,
    baseLevel: row.baseLevel || 0,
    maxLevel: row.maxLevel || 0,
    recoveryTime: row.recoveryTime || 0,
    categoryRecoveryTime: row.categoryRecoveryTime || 0,
    schoolMask: row.schoolMask || 0,
    dmgClass: row.dmgClass || 0,
    procFlags: row.procFlags || 0,
    procChance: row.procChance || 0,
    procCharges: row.procCharges || 0,
    chargeCategoryId: row.chargeCategoryId || 0,
    speed: row.speed || 0,
    stackAmount: row.stackAmount || 0,
    castingTimeIndex: row.castingTimeIndex || 0,
    durationIndex: row.durationIndex || 0,
    rangeIndex: row.rangeIndex || 0,
    spellFamilyName: row.spellFamilyName || 0,
    preventionType: row.preventionType || 0,
    categoryId: row.categoryId || 0,
    startRecoveryCategory: row.startRecoveryCategory || 0,
    startRecoveryTime: row.startRecoveryTime || 0,
    contentTuningId: row.contentTuningId || 0,
    mechanic: row.mechanic || 0,
    dispel: row.dispel || 0,
    equippedItemClass: row.equippedItemClass ?? -1,
  };
}
