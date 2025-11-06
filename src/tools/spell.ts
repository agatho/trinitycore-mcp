/**
 * Spell data query tool
 * Week 7: Enhanced with Spell.db2 integration via DB2CachedFileLoader
 */

import { queryWorld } from "../database/connection.js";
import { DB2CachedLoaderFactory } from "../parsers/db2/DB2CachedFileLoader.js";
import { SchemaFactory } from "../parsers/schemas/SchemaFactory.js";
import * as path from "path";
import * as fs from "fs";
import {
  getSpellRange as getSpellRangeData,
  getSpellRangeDescription,
  isMeleeRange,
  isUnlimitedRange,
  getMaxEffectiveRange,
  type SpellRangeEntry
} from "../data/spell-ranges.js";
import { logger } from '../utils/logger.js';
import {
  parseAttributeBitfield,
  getAttributeFlagsByCategory,
  AttributeCategory,
  type AttributeFlag
} from "../data/spell-attributes.js";

export interface SpellInfo {
  spellId: number;
  name: string;
  rank?: string;
  description?: string;
  tooltip?: string;
  category: number;
  dispel: number;
  mechanic: number;
  attributes: string[];
  castTime: number;
  cooldown: number;
  duration: number;
  powerCost: number;
  powerType: string;
  range: {
    min: number;
    max: number;
    description?: string;
    hostile?: { min: number; max: number };
    friendly?: { min: number; max: number };
    isMelee?: boolean;
    isUnlimited?: boolean;
  };
  speed: number;
  effects: SpellEffect[];
  // Week 7: Enhanced with DB2 data
  db2Data?: {
    spellName?: string;
    rank?: string;
    description?: string;
    spellIconFileDataID?: number;
    activeIconFileDataID?: number;
  };
  dataSource: "database" | "db2" | "merged";
  cacheStats?: {
    db2CacheHit: boolean;
    loadTime?: string;
  };
  error?: string;
}

export interface SpellEffect {
  index: number;
  effect: number;
  effectName: string;
  basePoints: number;
  radiusIndex: number;
  aura: number;
  auraName?: string;
  implicitTargetA: number;
  implicitTargetB: number;
}

// DB2 file paths
const DB2_PATH = process.env.DB2_PATH || "./data/db2";
// Use SpellName.db2 which contains actual spell names (not Spell.db2)
// Based on TrinityCore's sSpellNameStore("SpellName.db2")
const SPELL_DB2_FILE = "SpellName.db2";

// Spell name cache (loaded from DBCD-generated JSON)
const SPELL_NAME_CACHE_PATH = "./data/cache/spell_names_cache.json";
let spellNameCache: Map<number, string> | null = null;

// Spell data cache (loaded from DBCD-generated JSON - complete Spell.db2 data)
const SPELL_DATA_CACHE_PATH = "./data/cache/spell_data_cache.json";
interface SpellDataCacheEntry {
  ID: number;
  NameSubtext_lang?: string;
  Description_lang?: string;
  AuraDescription_lang?: string;
}
let spellDataCache: Map<number, SpellDataCacheEntry> | null = null;

/**
 * Load spell name cache from DBCD-generated JSON
 * This provides 100% accurate spell names extracted using the proven DBCD library
 * @returns True if cache loaded successfully
 */
function loadSpellNameCache(): boolean {
  if (spellNameCache !== null) {
    return true; // Already loaded
  }

  try {
    if (!fs.existsSync(SPELL_NAME_CACHE_PATH)) {
      logger.warn(`Spell name cache not found at ${SPELL_NAME_CACHE_PATH}. Falling back to DB2 parsing.`);
      return false;
    }

    const cacheData = JSON.parse(fs.readFileSync(SPELL_NAME_CACHE_PATH, 'utf8'));
    spellNameCache = new Map<number, string>();

    // Convert JSON object to Map
    for (const [key, value] of Object.entries(cacheData)) {
      spellNameCache.set(parseInt(key), value as string);
    }

    logger.info(`✅ Loaded spell name cache: ${spellNameCache.size} entries`);
    return true;
  } catch (error) {
    logger.error(`Failed to load spell name cache: ${error}`);
    spellNameCache = null;
    return false;
  }
}

/**
 * Get spell name from cache (100% accurate, O(1) lookup)
 * Falls back to DB2 parsing if cache unavailable
 * @param spellId Spell ID to query
 * @returns Spell name or null if not found
 */
function getSpellNameFromCache(spellId: number): string | null {
  // Lazy load cache on first access
  if (spellNameCache === null) {
    loadSpellNameCache();
  }

  // If cache available, use it (100% accurate)
  if (spellNameCache !== null) {
    return spellNameCache.get(spellId) || null;
  }

  // Cache unavailable, caller will fall back to DB2 parsing
  return null;
}

/**
 * Load spell data cache from DBCD-generated JSON
 * This provides complete Spell.db2 data (descriptions, ranks, etc.) as fallback
 * when Trinity database doesn't have the data
 * @returns True if cache loaded successfully
 */
function loadSpellDataCache(): boolean {
  if (spellDataCache !== null) {
    return true; // Already loaded
  }

  try {
    if (!fs.existsSync(SPELL_DATA_CACHE_PATH)) {
      logger.warn(`Spell data cache not found at ${SPELL_DATA_CACHE_PATH}. Using database only.`);
      return false;
    }

    const cacheData = JSON.parse(fs.readFileSync(SPELL_DATA_CACHE_PATH, 'utf8'));
    spellDataCache = new Map<number, SpellDataCacheEntry>();

    // Convert JSON object to Map
    for (const [key, value] of Object.entries(cacheData)) {
      spellDataCache.set(parseInt(key), value as SpellDataCacheEntry);
    }

    logger.info(`✅ Loaded spell data cache: ${spellDataCache.size} entries`);
    return true;
  } catch (error) {
    logger.error(`Failed to load spell data cache: ${error}`);
    spellDataCache = null;
    return false;
  }
}

/**
 * Get complete spell data from cache (descriptions, ranks, etc.)
 * This is used as fallback when Trinity database doesn't have the spell data
 * @param spellId Spell ID to query
 * @returns Spell data entry or null if not found
 */
function getSpellDataFromCache(spellId: number): SpellDataCacheEntry | null {
  // Lazy load cache on first access
  if (spellDataCache === null) {
    loadSpellDataCache();
  }

  // If cache available, use it
  if (spellDataCache !== null) {
    return spellDataCache.get(spellId) || null;
  }

  // Cache unavailable
  return null;
}

/**
 * Load spell data from Spell.db2 via cached loader
 * PRIORITY 1: Use JSON cache (100% accurate, extracted via DBCD)
 * PRIORITY 2: Fall back to DB2 parsing if cache unavailable
 * @param spellId Spell ID to query
 * @returns Parsed SpellEntry with spell name
 */
async function loadSpellFromDB2(spellId: number): Promise<{
  data: any | null;
  cacheHit: boolean;
  loadTime: number;
  source: "json-cache" | "db2-parser" | "none";
}> {
  const startTime = Date.now();

  try {
    // PRIORITY 1: Try JSON cache first (100% accurate)
    const cachedName = getSpellNameFromCache(spellId);
    if (cachedName !== null) {
      return {
        data: { Name_lang: cachedName },
        cacheHit: true,
        loadTime: Date.now() - startTime,
        source: "json-cache"
      };
    }

    // PRIORITY 2: Fall back to DB2 parsing
    const filePath = path.join(DB2_PATH, SPELL_DB2_FILE);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        data: null,
        cacheHit: false,
        loadTime: Date.now() - startTime,
        source: "none"
      };
    }

    // Get cached loader (singleton per file)
    const loader = DB2CachedLoaderFactory.getLoader(SPELL_DB2_FILE);

    // Load file if not already loaded
    try {
      if (loader.getRecordCount() === 0) {
        loader.loadFromFile(filePath);
      }
    } catch (loadError) {
      loader.loadFromFile(filePath);
    }

    // Get cache stats before access
    const statsBefore = loader.getCacheStats();
    const hitsBefore = statsBefore.totalHits;

    // Try to get typed record (automatically cached)
    const spellEntry = loader.getTypedRecord<any>(spellId);

    // Check if this was a cache hit
    const statsAfter = loader.getCacheStats();
    const cacheHit = statsAfter.totalHits > hitsBefore;

    return {
      data: spellEntry,
      cacheHit,
      loadTime: Date.now() - startTime,
      source: "db2-parser"
    };
  } catch (error) {
    logger.error("Error loading spell from DB2:", error);
    return {
      data: null,
      cacheHit: false,
      loadTime: Date.now() - startTime,
      source: "none"
    };
  }
}

/**
 * Get detailed spell information from world database and Spell.db2
 * Week 7: Enhanced to merge database + DB2 data with caching
 */
export async function getSpellInfo(spellId: number): Promise<SpellInfo> {
  try {
    // Step 1: Load from DB2 (with caching - JSON cache or DB2 parser)
    const db2Result = await loadSpellFromDB2(spellId);
    const db2Spell = db2Result.data;

    // Step 2: Query serverside_spell for database data (only for server-side custom spells)
    // Note: Most spells only exist in Spell.db2/JSON cache, not in the database
    // Gracefully handle database connection errors since we have DB2/cache as fallback
    let dbSpell = null;
    try {
      const spellQuery = `
        SELECT
          Id as spellId,
          SpellName as name,
          CategoryId as category,
          Dispel as dispel,
          Mechanic as mechanic,
          CastingTimeIndex as castTime,
          RecoveryTime as cooldown,
          DurationIndex as duration,
          Speed as speed,
          RangeIndex as rangeIndex,
          SchoolMask as schoolMask
        FROM serverside_spell
        WHERE Id = ? AND DifficultyID = 0
        LIMIT 1
      `;

      const spells = await queryWorld(spellQuery, [spellId]);
      dbSpell = spells && spells.length > 0 ? spells[0] : null;
    } catch (dbError) {
      // Database unavailable - not fatal, we have DB2/cache data
      logger.warn(`Database query failed for spell ${spellId}, using DB2/cache only:`, dbError instanceof Error ? dbError.message : String(dbError));
    }

    // Step 3: Try Spell.db2 data cache as fallback (descriptions, ranks, etc.)
    // This provides complete spell data when Trinity database doesn't have it
    const cachedSpellData = getSpellDataFromCache(spellId);

    // Step 4: Determine data source
    let dataSource: "database" | "db2" | "merged" = "database";
    if (db2Spell && dbSpell) {
      dataSource = "merged";
    } else if (db2Spell && !dbSpell) {
      dataSource = "db2";
    } else if (!db2Spell && !dbSpell && !cachedSpellData) {
      // Neither source has data
      return {
        spellId,
        name: "Not Found",
        category: 0,
        dispel: 0,
        mechanic: 0,
        attributes: [],
        castTime: 0,
        cooldown: 0,
        duration: 0,
        powerCost: 0,
        powerType: "MANA",
        range: { min: 0, max: 0 },
        speed: 0,
        effects: [],
        dataSource: "database",
        cacheStats: {
          db2CacheHit: db2Result.cacheHit,
          loadTime: `${db2Result.loadTime}ms`,
        },
        error: `Spell ${spellId} not found in database, DB2, or cache`,
      };
    }

    // Step 4: Merge data (prefer database for gameplay values, DB2 for names/descriptions)
    const spell = dbSpell || {};

    // Query spell effects from serverside_spell_effect (only for server-side custom spells)
    // Note: Most spell effects only exist in SpellEffect.db2, not in the database
    // Gracefully handle database connection errors
    const effects: SpellEffect[] = [];
    try {
      const effectsQuery = `
        SELECT
          EffectIndex as effectIndex,
          Effect as effect,
          EffectBasePoints as basePoints,
          EffectRadiusIndex1 as radiusIndex,
          EffectAura as aura,
          ImplicitTarget1 as targetA,
          ImplicitTarget2 as targetB
        FROM serverside_spell_effect
        WHERE SpellID = ? AND DifficultyID = 0
        ORDER BY EffectIndex
      `;

      const effectsData = await queryWorld(effectsQuery, [spellId]);

      if (effectsData && effectsData.length > 0) {
        for (const effectRow of effectsData) {
          effects.push({
            index: effectRow.effectIndex || 0,
            effect: effectRow.effect || 0,
            effectName: getEffectName(effectRow.effect),
            basePoints: effectRow.basePoints || 0,
            radiusIndex: effectRow.radiusIndex || 0,
            aura: effectRow.aura || 0,
            auraName: getAuraName(effectRow.aura),
            implicitTargetA: effectRow.targetA || 0,
            implicitTargetB: effectRow.targetB || 0,
          });
        }
      }
    } catch (effectsError) {
      // Database unavailable - not fatal, effects will be empty
      logger.warn(`Effects query failed for spell ${spellId}:`, effectsError instanceof Error ? effectsError.message : String(effectsError));
    }

    // Extract spell name from DB2 data (JSON cache uses Name_lang field)
    const db2SpellName = db2Spell?.Name_lang || db2Spell?.spellName;

    // Use cached spell data for descriptions and rank as fallback
    const spellDescription = spell.description || cachedSpellData?.Description_lang || db2Spell?.description;
    const spellRank = spell.rank || cachedSpellData?.NameSubtext_lang || db2Spell?.rank;
    const auraDescription = cachedSpellData?.AuraDescription_lang;

    return {
      spellId: spell.spellId || spellId,
      name: spell.name || db2SpellName || "Unknown",
      rank: spellRank,
      description: spellDescription,
      tooltip: spell.tooltip || auraDescription,
      category: spell.category || 0,
      dispel: spell.dispel || 0,
      mechanic: spell.mechanic || 0,
      attributes: parseAttributes(spell),
      castTime: spell.castTime || 0,
      cooldown: spell.cooldown || 0,
      duration: spell.duration || 0,
      powerCost: spell.powerCost || 0,
      powerType: getPowerTypeName(spell.powerType),
      range: getSpellRange(spell.rangeIndex || 0),
      speed: spell.speed || 0,
      effects,
      // Week 7: Include DB2 data (supports both JSON cache and DB2 parser formats)
      db2Data: db2Spell
        ? {
            spellName: db2SpellName,
            rank: db2Spell.rank,
            description: db2Spell.description,
            spellIconFileDataID: db2Spell.spellIconFileDataID,
            activeIconFileDataID: db2Spell.activeIconFileDataID,
          }
        : undefined,
      dataSource,
      cacheStats: {
        db2CacheHit: db2Result.cacheHit,
        loadTime: `${db2Result.loadTime}ms`,
      },
    };
  } catch (error) {
    return {
      spellId,
      name: "Error",
      category: 0,
      dispel: 0,
      mechanic: 0,
      attributes: [],
      castTime: 0,
      cooldown: 0,
      duration: 0,
      powerCost: 0,
      powerType: "UNKNOWN",
      range: { min: 0, max: 0 },
      speed: 0,
      effects: [],
      dataSource: "database",
      cacheStats: {
        db2CacheHit: false,
        loadTime: "0ms",
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Spell attribute flag parsing
 * Now uses comprehensive spell-attributes.ts database with all 512 flags (Attr0-15)
 * Phase 7 Enhancement #2: Replaced limited 160-flag mapping with complete 512-flag database
 */

/**
 * Parse spell attribute flags from database fields
 * Enhancement #2 (Phase 7): Now parses ALL 512 flags across Attributes0-15
 *
 * @param spell - Spell record from database with Attributes0-15 fields
 * @returns Array of human-readable attribute flag names
 */
function parseAttributes(spell: any): string[] {
  const attributes: string[] = [];

  try {
    // Parse all 16 attribute fields (Attributes0-15)
    // Phase 7 Enhancement #2: Expanded from 5 to 16 attribute fields (160 → 512 flags)
    for (let attrIndex = 0; attrIndex <= 15; attrIndex++) {
      const attrField = `Attributes${attrIndex}`;
      const attrValue = spell[attrField];

      if (attrValue) {
        // Use parseAttributeBitfield from spell-attributes.ts
        const matchedFlags = parseAttributeBitfield(attrIndex, attrValue);

        // Convert to legacy format: "ATTR{index}_{name}"
        for (const flag of matchedFlags) {
          attributes.push(`ATTR${attrIndex}_${flag.name}`);
        }
      }
    }
  } catch (error) {
    // Graceful degradation - return empty array on error
    logger.error("Error parsing spell attributes:", error);
  }

  return attributes;
}

function getPowerTypeName(powerType: number): string {
  const types = ["MANA", "RAGE", "FOCUS", "ENERGY", "HAPPINESS", "RUNE", "RUNIC_POWER"];
  return types[powerType] || "UNKNOWN";
}

function getEffectName(effect: number): string {
  const effects: { [key: number]: string } = {
    0: "NONE",
    1: "INSTAKILL",
    2: "SCHOOL_DAMAGE",
    3: "DUMMY",
    4: "PORTAL_TELEPORT",
    5: "TELEPORT_UNITS",
    6: "APPLY_AURA",
    7: "ENVIRONMENTAL_DAMAGE",
    8: "POWER_DRAIN",
    9: "HEALTH_LEECH",
    10: "HEAL",
    // Add more as needed
  };
  return effects[effect] || `EFFECT_${effect}`;
}

function getAuraName(aura: number): string {
  const auras: { [key: number]: string } = {
    0: "NONE",
    1: "BIND_SIGHT",
    2: "MOD_POSSESS",
    3: "PERIODIC_DAMAGE",
    4: "DUMMY",
    5: "MOD_CONFUSE",
    6: "MOD_CHARM",
    7: "MOD_FEAR",
    8: "PERIODIC_HEAL",
    // Add more as needed
  };
  return auras[aura] || `AURA_${aura}`;
}

/**
 * Get spell range from rangeIndex using comprehensive SpellRange.dbc database
 * Week 1 Enhancement: Replaced hardcoded table with accurate DBC data
 *
 * @param rangeIndex - Index into SpellRange.dbc
 * @returns Enhanced object with min, max, hostile/friendly distinction, and metadata
 */
function getSpellRange(rangeIndex: number): {
  min: number;
  max: number;
  description?: string;
  hostile?: { min: number; max: number };
  friendly?: { min: number; max: number };
  isMelee?: boolean;
  isUnlimited?: boolean;
} {
  // Get spell range entry from comprehensive database
  const rangeEntry = getSpellRangeData(rangeIndex);

  if (!rangeEntry) {
    // Default fallback for unknown range IDs (40 yards - most common)
    return {
      min: 0,
      max: 40,
      description: "Unknown range (default 40yd)",
      hostile: { min: 0, max: 40 },
      friendly: { min: 0, max: 40 },
      isMelee: false,
      isUnlimited: false,
    };
  }

  // Extract common min/max (prefer hostile for general use)
  const minRange = Math.min(rangeEntry.minRangeHostile, rangeEntry.minRangeFriend);
  const maxRange = Math.max(rangeEntry.maxRangeHostile, rangeEntry.maxRangeFriend);

  return {
    min: minRange,
    max: maxRange,
    description: getSpellRangeDescription(rangeIndex),
    hostile: {
      min: rangeEntry.minRangeHostile,
      max: rangeEntry.maxRangeHostile,
    },
    friendly: {
      min: rangeEntry.minRangeFriend,
      max: rangeEntry.maxRangeFriend,
    },
    isMelee: isMeleeRange(rangeIndex),
    isUnlimited: isUnlimitedRange(rangeIndex),
  };
}
