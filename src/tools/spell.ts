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
const SPELL_DB2_FILE = "Spell.db2";

/**
 * Load spell data from Spell.db2 via cached loader
 * @param spellId Spell ID to query
 * @returns Parsed SpellEntry or null if not found
 */
async function loadSpellFromDB2(spellId: number): Promise<{
  data: any | null;
  cacheHit: boolean;
  loadTime: number;
}> {
  const startTime = Date.now();

  try {
    const filePath = path.join(DB2_PATH, SPELL_DB2_FILE);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { data: null, cacheHit: false, loadTime: Date.now() - startTime };
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
    };
  } catch (error) {
    console.error("Error loading spell from DB2:", error);
    return { data: null, cacheHit: false, loadTime: Date.now() - startTime };
  }
}

/**
 * Get detailed spell information from world database and Spell.db2
 * Week 7: Enhanced to merge database + DB2 data with caching
 */
export async function getSpellInfo(spellId: number): Promise<SpellInfo> {
  try {
    // Step 1: Load from DB2 (with caching)
    const db2Result = await loadSpellFromDB2(spellId);
    const db2Spell = db2Result.data;

    // Step 2: Query spell_template for database data
    const spellQuery = `
      SELECT
        ID as spellId,
        SpellName as name,
        Rank as rank,
        Description as description,
        AuraDescription as tooltip,
        Category as category,
        Dispel as dispel,
        Mechanic as mechanic,
        CastTimeIndex as castTime,
        RecoveryTime as cooldown,
        DurationIndex as duration,
        ManaCost as powerCost,
        PowerType as powerType,
        Speed as speed,
        RangeIndex as rangeIndex
      FROM spell_template
      WHERE ID = ?
      LIMIT 1
    `;

    const spells = await queryWorld(spellQuery, [spellId]);
    const dbSpell = spells && spells.length > 0 ? spells[0] : null;

    // Step 3: Determine data source
    let dataSource: "database" | "db2" | "merged" = "database";
    if (db2Spell && dbSpell) {
      dataSource = "merged";
    } else if (db2Spell && !dbSpell) {
      dataSource = "db2";
    } else if (!db2Spell && !dbSpell) {
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
        error: `Spell ${spellId} not found in database or DB2`,
      };
    }

    // Step 4: Merge data (prefer database for gameplay values, DB2 for names/descriptions)
    const spell = dbSpell || {};

    // Query spell effects
    const effectsQuery = `
      SELECT
        EffectIndex as effectIndex,
        Effect as effect,
        EffectBasePoints as basePoints,
        EffectRadiusIndex as radiusIndex,
        EffectApplyAuraName as aura,
        EffectImplicitTargetA as targetA,
        EffectImplicitTargetB as targetB
      FROM spell_template
      WHERE ID = ?
    `;

    const effectsData = await queryWorld(effectsQuery, [spellId]);

    const effects: SpellEffect[] = [];
    if (effectsData && effectsData.length > 0) {
      for (let i = 0; i < 3; i++) {
        const effectKey = `Effect_${i}`;
        if (spell[effectKey]) {
          effects.push({
            index: i,
            effect: spell[effectKey],
            effectName: getEffectName(spell[effectKey]),
            basePoints: spell[`EffectBasePoints_${i}`] || 0,
            radiusIndex: spell[`EffectRadiusIndex_${i}`] || 0,
            aura: spell[`EffectApplyAuraName_${i}`] || 0,
            auraName: getAuraName(spell[`EffectApplyAuraName_${i}`]),
            implicitTargetA: spell[`EffectImplicitTargetA_${i}`] || 0,
            implicitTargetB: spell[`EffectImplicitTargetB_${i}`] || 0,
          });
        }
      }
    }

    return {
      spellId: spell.spellId || spellId,
      name: spell.name || db2Spell?.spellName || "Unknown",
      rank: spell.rank || db2Spell?.rank,
      description: spell.description || db2Spell?.description,
      tooltip: spell.tooltip,
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
      // Week 7: Include DB2 data
      db2Data: db2Spell
        ? {
            spellName: db2Spell.spellName,
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
    console.error("Error parsing spell attributes:", error);
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
