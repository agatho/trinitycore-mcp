/**
 * Spell data query tool
 */

import { queryWorld } from "../database/connection.js";

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
  };
  speed: number;
  effects: SpellEffect[];
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

/**
 * Get detailed spell information from world database
 */
export async function getSpellInfo(spellId: number): Promise<SpellInfo> {
  try {
    // Query spell_template for basic spell data
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

    if (!spells || spells.length === 0) {
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
        error: `Spell ${spellId} not found in database`,
      };
    }

    const spell = spells[0];

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
      spellId: spell.spellId,
      name: spell.name,
      rank: spell.rank,
      description: spell.description,
      tooltip: spell.tooltip,
      category: spell.category,
      dispel: spell.dispel,
      mechanic: spell.mechanic,
      attributes: parseAttributes(spell),
      castTime: spell.castTime,
      cooldown: spell.cooldown,
      duration: spell.duration,
      powerCost: spell.powerCost,
      powerType: getPowerTypeName(spell.powerType),
      range: {
        min: 0,
        max: 40, // TODO: Look up from SpellRange.dbc based on rangeIndex
      },
      speed: spell.speed,
      effects,
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
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseAttributes(spell: any): string[] {
  const attributes: string[] = [];
  // TODO: Parse spell attribute flags
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
