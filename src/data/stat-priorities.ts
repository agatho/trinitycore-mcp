/**
 * Stat Priorities Database for WoW 11.2 (The War Within)
 *
 * IMPORTANT: Stat priorities are GUIDELINES, not absolute values.
 * Real stat weights vary based on:
 * - Current gear composition
 * - Tier set bonuses
 * - Talent choices
 * - Fight type (single-target vs AoE)
 * - Encounter length
 *
 * These priorities are based on Icy Veins guides (updated for 11.2.5) and represent
 * typical stat valuations for each spec in raid environments.
 *
 * For accurate optimization, use SimulationCraft to sim your specific character.
 *
 * Stat Weight Scale:
 * - Primary Stat (Str/Agi/Int): 1.00 (baseline)
 * - Secondary Stats: 0.30-0.95 (varies by spec and priority)
 *
 * @module data/stat-priorities
 */

export enum StatType {
    // Primary Stats
    STRENGTH = 'strength',
    AGILITY = 'agility',
    INTELLECT = 'intellect',
    STAMINA = 'stamina',

    // Secondary Stats
    CRITICAL_STRIKE = 'criticalStrike',
    HASTE = 'haste',
    MASTERY = 'mastery',
    VERSATILITY = 'versatility',

    // Defensive Stats (tanks)
    ARMOR = 'armor',
    AVOIDANCE = 'avoidance',
    LEECH = 'leech',
}

export enum ContentType {
    RAID_DPS = 'raid_dps',           // Single-target raid boss damage
    MYTHIC_PLUS = 'mythic_plus',     // AoE + priority damage for M+
    PVP = 'pvp',                     // Arena/battleground burst
    TANK = 'tank',                   // Survivability and threat
    HEALER = 'healer',               // Throughput and efficiency
    LEVELING = 'leveling',           // Efficiency while leveling
}

export interface StatPriority {
    classId: number;
    className: string;
    specId: number;
    specName: string;
    contentType: ContentType;

    // Stat weights (primary stat is always 1.00)
    weights: {
        primaryStat: number;      // Always 1.00
        criticalStrike?: number;
        haste?: number;
        mastery?: number;
        versatility?: number;
        armor?: number;           // Tanks only
        avoidance?: number;       // Tanks only
        leech?: number;           // Optional
    };

    // Ordered priority list (most important first)
    priorityOrder: StatType[];

    // Special considerations
    notes?: string;
    statCaps?: { stat: StatType; value: number; reason: string }[];

    // Metadata
    source: string;               // "Icy Veins 11.2.5"
    updatedDate: string;          // "2025-11-01"
    patch: string;                // "11.2.5"
}

/**
 * Comprehensive stat priority database for all 13 classes and 39 specializations
 *
 * Data sourced from:
 * - Icy Veins (The War Within 11.2.5 guides)
 * - Community theorycrafting (class Discords)
 * - SimulationCraft baseline recommendations
 *
 * Updated: November 1, 2025
 * Patch: 11.2.5 (The War Within)
 */
export const STAT_PRIORITIES: StatPriority[] = [

    // ============================================================================
    // WARRIOR (Class ID: 1)
    // ============================================================================

    {
        classId: 1,
        className: 'Warrior',
        specId: 71,
        specName: 'Arms',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.85,
            haste: 0.75,
            mastery: 0.82,
            versatility: 0.70,
        },
        priorityOrder: [StatType.STRENGTH, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit doubles damage and increases Rage. Stats converge at high gear levels due to diminishing returns.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 1,
        className: 'Warrior',
        specId: 72,
        specName: 'Fury',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            criticalStrike: 0.82,
            mastery: 0.78,
            versatility: 0.72,
        },
        priorityOrder: [StatType.STRENGTH, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste reduces GCD and compresses rotation. Enrage uptime is crucial.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 1,
        className: 'Warrior',
        specId: 73,
        specName: 'Protection',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.75,
            versatility: 0.72,
            mastery: 0.68,
            criticalStrike: 0.65,
            armor: 0.80,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Haste reduces rage generation and block uptime. Versatility provides damage reduction.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // PALADIN (Class ID: 2)
    // ============================================================================

    {
        classId: 2,
        className: 'Paladin',
        specId: 65,
        specName: 'Holy',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            haste: 0.85,
            criticalStrike: 0.80,
            mastery: 0.75,
            versatility: 0.72,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste reduces GCD and cast times. Mastery increases healing on low-health targets.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 2,
        className: 'Paladin',
        specId: 66,
        specName: 'Protection',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.78,
            versatility: 0.75,
            mastery: 0.72,
            criticalStrike: 0.68,
            armor: 0.82,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Haste improves Holy Power generation. Mastery increases block chance.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 2,
        className: 'Paladin',
        specId: 70,
        specName: 'Retribution',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.88,
            haste: 0.82,
            versatility: 0.78,
            mastery: 0.75,
        },
        priorityOrder: [StatType.STRENGTH, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit increases damage and Holy Power generation through Art of War procs.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // HUNTER (Class ID: 3)
    // ============================================================================

    {
        classId: 3,
        className: 'Hunter',
        specId: 253,
        specName: 'Beast Mastery',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.92,
            criticalStrike: 0.92,
            versatility: 0.78,
            mastery: 0.75,
        },
        priorityOrder: [StatType.AGILITY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste and Crit are roughly equal in value. Dark Ranger hero spec prioritizes Haste >= Crit.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 3,
        className: 'Hunter',
        specId: 254,
        specName: 'Marksmanship',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.95,
            mastery: 0.82,
            haste: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Crit is practically always best. Mastery/Haste/Vers are close in value after Crit.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 3,
        className: 'Hunter',
        specId: 255,
        specName: 'Survival',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            criticalStrike: 0.85,
            versatility: 0.80,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste improves focus regeneration and cooldown reduction.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // ROGUE (Class ID: 4)
    // ============================================================================

    {
        classId: 4,
        className: 'Rogue',
        specId: 259,
        specName: 'Assassination',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.90,
            haste: 0.85,
            mastery: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit increases poison proc chance and Envenom damage.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 4,
        className: 'Rogue',
        specId: 260,
        specName: 'Outlaw',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            versatility: 0.88,
            criticalStrike: 0.85,
            haste: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.VERSATILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY],
        notes: 'Versatility is strong for Outlaw. Stats are relatively close in value.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 4,
        className: 'Rogue',
        specId: 261,
        specName: 'Subtlety',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.92,
            versatility: 0.85,
            haste: 0.80,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.HASTE, StatType.MASTERY],
        notes: 'Crit increases Eviscerate and Shadow Dance damage.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // PRIEST (Class ID: 5)
    // ============================================================================

    {
        classId: 5,
        className: 'Priest',
        specId: 256,
        specName: 'Discipline',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            criticalStrike: 0.82,
            versatility: 0.78,
            mastery: 0.75,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste increases throughput through faster casts and more Atonement applications.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 5,
        className: 'Priest',
        specId: 257,
        specName: 'Holy',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            mastery: 0.85,
            haste: 0.82,
            criticalStrike: 0.78,
            versatility: 0.75,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery increases healing on low-health targets (Echo of Light).',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 5,
        className: 'Priest',
        specId: 258,
        specName: 'Shadow',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            mastery: 0.85,
            criticalStrike: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Voidweaver hero spec: aim for ~20% Haste, then balance Mastery/Crit/Vers.',
        statCaps: [
            { stat: StatType.HASTE, value: 20, reason: 'Optimal GCD compression for Voidweaver' },
        ],
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // DEATH KNIGHT (Class ID: 6)
    // ============================================================================

    {
        classId: 6,
        className: 'Death Knight',
        specId: 250,
        specName: 'Blood',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.82,
            versatility: 0.78,
            mastery: 0.75,
            criticalStrike: 0.70,
            armor: 0.85,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Haste improves rune regeneration and Blood Boil frequency.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 6,
        className: 'Death Knight',
        specId: 251,
        specName: 'Frost',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.88,
            criticalStrike: 0.85,
            haste: 0.72,
            versatility: 0.70,
        },
        priorityOrder: [StatType.STRENGTH, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Balance Mastery and Crit. Haste and Versatility have lower priority.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 6,
        className: 'Death Knight',
        specId: 252,
        specName: 'Unholy',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            haste: 0.85,
            criticalStrike: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.STRENGTH, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery increases pet damage significantly.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // SHAMAN (Class ID: 7)
    // ============================================================================

    {
        classId: 7,
        className: 'Shaman',
        specId: 262,
        specName: 'Elemental',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            versatility: 0.88,
            haste: 0.85,
            criticalStrike: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.VERSATILITY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY],
        notes: 'Farseer hero spec: Versatility becomes more desirable than Haste with 2-piece tier set.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 7,
        className: 'Shaman',
        specId: 263,
        specName: 'Enhancement',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            mastery: 0.85,
            criticalStrike: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.HASTE, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Haste improves Maelstrom Weapon stack generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 7,
        className: 'Shaman',
        specId: 264,
        specName: 'Restoration',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.88,
            haste: 0.85,
            versatility: 0.78,
            mastery: 0.75,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit increases Resurgence mana regen and healing throughput.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // MAGE (Class ID: 8)
    // ============================================================================

    {
        classId: 8,
        className: 'Mage',
        specId: 62,
        specName: 'Arcane',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.90,
            mastery: 0.85,
            criticalStrike: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Haste improves mana regeneration and spell cast speed.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 8,
        className: 'Mage',
        specId: 63,
        specName: 'Fire',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.92,
            haste: 0.85,
            mastery: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit enables Pyroblast procs through Hot Streak.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 8,
        className: 'Mage',
        specId: 64,
        specName: 'Frost',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            criticalStrike: 0.85,
            mastery: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit soft cap at 33.34% due to Shatter mechanics. Haste > Crit until cap reached.',
        statCaps: [
            { stat: StatType.CRITICAL_STRIKE, value: 33.34, reason: 'Shatter cap - effective drop-off beyond this point' },
        ],
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // WARLOCK (Class ID: 9)
    // ============================================================================

    {
        classId: 9,
        className: 'Warlock',
        specId: 265,
        specName: 'Affliction',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.92,
            mastery: 0.88,
            criticalStrike: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Haste increases dot tick rate and soul shard generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 9,
        className: 'Warlock',
        specId: 266,
        specName: 'Demonology',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.90,
            criticalStrike: 0.85,
            versatility: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste reduces cast times and improves Demonbolt generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 9,
        className: 'Warlock',
        specId: 267,
        specName: 'Destruction',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.90,
            haste: 0.88,
            versatility: 0.82,
            mastery: 0.80,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit increases Chaos Bolt damage and soul shard generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // MONK (Class ID: 10)
    // ============================================================================

    {
        classId: 10,
        className: 'Monk',
        specId: 268,
        specName: 'Brewmaster',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.82,
            criticalStrike: 0.78,
            versatility: 0.75,
            mastery: 0.72,
            armor: 0.85,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste improves energy regeneration and purifying brew availability.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 10,
        className: 'Monk',
        specId: 270,
        specName: 'Mistweaver',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.88,
            versatility: 0.85,
            haste: 0.82,
            mastery: 0.75,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.HASTE, StatType.MASTERY],
        notes: 'Crit increases throughput and mana efficiency through mana tea.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 10,
        className: 'Monk',
        specId: 269,
        specName: 'Windwalker',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            versatility: 0.88,
            criticalStrike: 0.85,
            haste: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.VERSATILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY],
        notes: 'Versatility provides consistent damage increase for all abilities.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // DRUID (Class ID: 11)
    // ============================================================================

    {
        classId: 11,
        className: 'Druid',
        specId: 102,
        specName: 'Balance',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.90,
            criticalStrike: 0.88,
            versatility: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Haste improves Astral Power generation and dot tick rate.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 103,
        specName: 'Feral',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.88,
            haste: 0.85,
            versatility: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit increases bleed damage through Bloodtalons and direct damage.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 104,
        specName: 'Guardian',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.80,
            versatility: 0.78,
            mastery: 0.75,
            criticalStrike: 0.70,
            armor: 0.88,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Armor provides huge survivability boost. Haste improves rage generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 105,
        specName: 'Restoration',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            haste: 0.88,
            criticalStrike: 0.85,
            mastery: 0.72,
            versatility: 0.70,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste reduces GCD and improves HoT tick rate.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // DEMON HUNTER (Class ID: 12)
    // ============================================================================

    {
        classId: 12,
        className: 'Demon Hunter',
        specId: 577,
        specName: 'Havoc',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.90,
            haste: 0.85,
            versatility: 0.82,
            mastery: 0.78,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit increases Chaos Strike damage and fury generation.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 12,
        className: 'Demon Hunter',
        specId: 581,
        specName: 'Vengeance',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.85,
            versatility: 0.82,
            criticalStrike: 0.75,
            mastery: 0.72,
            armor: 0.80,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.CRITICAL_STRIKE, StatType.MASTERY],
        notes: 'Haste improves soul fragment generation and reduces GCD.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    // ============================================================================
    // EVOKER (Class ID: 13)
    // ============================================================================

    {
        classId: 13,
        className: 'Evoker',
        specId: 1467,
        specName: 'Devastation',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            criticalStrike: 0.88,
            haste: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Mastery increases damage of all spells. Crit close behind.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 13,
        className: 'Evoker',
        specId: 1468,
        specName: 'Preservation',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            mastery: 0.88,
            criticalStrike: 0.85,
            haste: 0.82,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Mastery increases healing based on proximity to target.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },

    {
        classId: 13,
        className: 'Evoker',
        specId: 1473,
        specName: 'Augmentation',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.92,
            haste: 0.85,
            criticalStrike: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'IMPORTANT: Do NOT use stat weight sims for Augmentation. Stat priorities vary significantly by fight.',
        source: 'Icy Veins 11.2.5',
        updatedDate: '2025-11-01',
        patch: '11.2.5',
    },
];

/**
 * Get stat priorities for a specific class/spec/content combination
 */
export function getStatPriority(
    classId: number,
    specId: number,
    contentType: ContentType = ContentType.RAID_DPS
): StatPriority | undefined {
    return STAT_PRIORITIES.find(
        p => p.classId === classId && p.specId === specId && p.contentType === contentType
    );
}

/**
 * Get all stat priorities for a class (all specs and content types)
 */
export function getClassStatPriorities(classId: number): StatPriority[] {
    return STAT_PRIORITIES.filter(p => p.classId === classId);
}

/**
 * Get all stat priorities for a spec across all content types
 */
export function getSpecStatPriorities(classId: number, specId: number): StatPriority[] {
    return STAT_PRIORITIES.filter(p => p.classId === classId && p.specId === specId);
}

/**
 * Get default stat weights (fallback when specific profile not found)
 */
export function getDefaultStatWeights(classId: number, specId: number): StatPriority | undefined {
    // Try raid DPS first (most common)
    let priority = getStatPriority(classId, specId, ContentType.RAID_DPS);

    // Fall back to any content type for this spec
    if (!priority) {
        priority = STAT_PRIORITIES.find(p => p.classId === classId && p.specId === specId);
    }

    return priority;
}
