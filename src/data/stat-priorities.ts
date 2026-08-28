/**
 * Stat Priorities Database
 *
 * IMPORTANT: Stat priorities are GUIDELINES, not absolute values.
 * Real stat weights vary based on:
 * - Current gear composition
 * - Tier set bonuses
 * - Talent choices
 * - Fight type (single-target vs AoE)
 * - Encounter length
 *
 * These priorities are based on Icy Veins guides and represent typical stat
 * valuations for each spec in raid environments. Every entry's `source`,
 * `updatedDate`, and `patch` fields record exactly which guide revision it
 * was sourced from; see `staleForBuild` on `StatPriority` for how entries
 * that could not be re-verified against a newer patch are flagged.
 *
 * For accurate optimization, use SimulationCraft to sim your specific character.
 *
 * Stat Weight Scale:
 * - Primary Stat (Str/Agi/Int): 1.00 (baseline)
 * - Secondary Stats: 0.30-0.95 (varies by spec and priority)
 *
 * @module data/stat-priorities
 */

/**
 * Game patch this file's hand-authored values were sourced against.
 * Update only when the content is genuinely re-researched.
 */
export const SOURCE_BUILD = "12.1.0";

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
    source: string;               // "Icy Veins 12.1"
    updatedDate: string;          // "2026-08-10"
    patch: string;                // "12.1.0"

    /**
     * True when this entry's `patch`/`source` could NOT be genuinely
     * re-verified against a newer game patch (no guide available, or the
     * guide could not be confirmed) and the values shown are carried over
     * from an older patch. Never set true and silently relabel `patch` to
     * the new version — that produces a wrong answer wearing a correct
     * label. When true, `patch` reflects the patch the values actually
     * describe, not the project's current target patch.
     */
    staleForBuild?: boolean;
}

/**
 * Comprehensive stat priority database for all 13 classes and 39 specializations
 *
 * Data sourced from:
 * - Icy Veins (Midnight 12.1 guides, re-verified August 2026)
 * - Community theorycrafting (class Discords)
 * - SimulationCraft baseline recommendations
 *
 * Updated: August 2026 (see per-entry `updatedDate` for the exact guide date)
 * Patch: 12.1.0 (Midnight)
 *
 * All 39 entries below were individually re-sourced against live Icy Veins
 * 12.1 guides (fetched August 27-28, 2026) rather than relabelled from the
 * prior Midnight-launch dataset. Where a spec has multiple Hero Talent trees with
 * materially different priorities, the entry follows the tree named first
 * in the guide and the alternate is called out in `notes`.
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
        notes: 'Crit, Haste, Mastery, Versatility in that order per Icy Veins. Stats converge at higher gear levels due to diminishing returns, so simming your own upgrades is recommended.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 1,
        className: 'Warrior',
        specId: 72,
        specName: 'Fury',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            haste: 0.86,
            versatility: 0.76,
            criticalStrike: 0.65,
        },
        priorityOrder: [StatType.STRENGTH, StatType.MASTERY, StatType.HASTE, StatType.VERSATILITY, StatType.CRITICAL_STRIKE],
        notes: 'Mastery now leads with Haste close behind for both Mountain Thane and Slayer builds; Versatility and Critical Strike trail. Early gearing favors Haste, transitioning toward Mastery as gear improves.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 1,
        className: 'Warrior',
        specId: 73,
        specName: 'Protection',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.84,
            versatility: 0.76,
            criticalStrike: 0.74,
            mastery: 0.60,
            armor: 0.80,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.CRITICAL_STRIKE, StatType.MASTERY],
        notes: 'Haste reduces Shield Slam/Thunder Clap and Shield Block cooldowns. Versatility and Critical Strike are roughly equal for mitigation (Versatility ahead on magic-heavy fights); Mastery is the weakest secondary.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            mastery: 0.86,
            haste: 0.83,
            criticalStrike: 0.78,
            versatility: 0.74,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery (proximity-based healing) now leads, with Haste close behind for Holy Shock/Judgment cooldown reduction. Secondaries are closely valued, so item level upgrades are usually still worth taking.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 2,
        className: 'Paladin',
        specId: 66,
        specName: 'Protection',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.84,
            versatility: 0.80,
            mastery: 0.70,
            criticalStrike: 0.62,
            armor: 0.82,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Defensive priority is Haste, Versatility, Mastery, Critical Strike. Haste raises Shield of the Righteous uptime (~20% covers rotational Holy Power, 25-30% is comfortable); Mastery: Divine Bulwark adds block chance and attack power.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 2,
        className: 'Paladin',
        specId: 70,
        specName: 'Retribution',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.87,
            haste: 0.83,
            criticalStrike: 0.79,
            versatility: 0.75,
        },
        priorityOrder: [StatType.STRENGTH, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery now leads, with Haste valued for Crusading Strikes resource generation and Holy Power cooldown reduction. No hard breakpoints; sim your own gear for precise values.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            mastery: 0.90,
            haste: 0.84,
            criticalStrike: 0.80,
            versatility: 0.68,
        },
        priorityOrder: [StatType.AGILITY, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery (Master of Beasts) now leads on single-target; Haste edges out Crit by a small margin there, though Crit pulls ahead for all-around/cleave value.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 3,
        className: 'Hunter',
        specId: 254,
        specName: 'Marksmanship',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.92,
            mastery: 0.88,
            versatility: 0.76,
            haste: 0.62,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY, StatType.HASTE],
        notes: '"Crit is king, with Mastery pretty close behind. Versatility is a chunk behind that, and Haste is your worst stat by some margin" per Icy Veins.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 3,
        className: 'Hunter',
        specId: 255,
        specName: 'Survival',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            criticalStrike: 0.83,
            haste: 0.82,
            versatility: 0.70,
        },
        priorityOrder: [StatType.AGILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Mastery now leads clearly; Crit and Haste are close enough to be treated as interchangeable regardless of Hero Talent choice.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            criticalStrike: 0.87,
            haste: 0.85,
            mastery: 0.83,
            versatility: 0.58,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit, Haste, and Mastery are very close, with item level the dominant factor via Agility. Versatility is explicitly deprioritized ("completely avoiding Versatility" per Icy Veins).',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 4,
        className: 'Rogue',
        specId: 260,
        specName: 'Outlaw',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.86,
            haste: 0.82,
            versatility: 0.75,
            mastery: 0.66,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Crit to ~40% and Haste to ~25-30% (raid) / ~25% (M+) are the early targets, then Versatility, with Mastery last. Priority is largely the same between raiding and Mythic+.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 4,
        className: 'Rogue',
        specId: 261,
        specName: 'Subtlety',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.87,
            haste: 0.83,
            versatility: 0.76,
            criticalStrike: 0.66,
        },
        priorityOrder: [StatType.AGILITY, StatType.MASTERY, StatType.HASTE, StatType.VERSATILITY, StatType.CRITICAL_STRIKE],
        notes: 'Mastery now leads; Haste targets roughly 700-1100 rating for both Trickster and Deathstalker. Critical Strike ranks last since Darkest Night already guarantees crits.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            haste: 0.90,
            mastery: 0.87,
            criticalStrike: 0.84,
            versatility: 0.80,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Haste (until ~1800 rating) leads for both Voidweaver and Oracle builds, followed by Mastery, Crit, and Versatility. Icy Veins notes all secondaries are very close in value; prioritize item level when otherwise equal.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 5,
        className: 'Priest',
        specId: 257,
        specName: 'Holy',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.86,
            mastery: 0.84,
            versatility: 0.80,
            haste: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY, StatType.HASTE],
        notes: 'Raid priority is Critical Strike, Mastery, Versatility, Haste (all close in value); for Mythic+ the order shifts to Crit, Versatility, Haste, Mastery as survivability stats gain importance.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 5,
        className: 'Priest',
        specId: 258,
        specName: 'Shadow',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.88,
            haste: 0.82,
            criticalStrike: 0.78,
            versatility: 0.55,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Voidweaver build: Mastery (1200-1400 rating), then Haste (1400-1800), Crit (800-1200), Versatility (below 400). Archon build swaps Haste and Crit order; Versatility remains last for both.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            haste: 0.85,
            criticalStrike: 0.78,
            mastery: 0.72,
            versatility: 0.66,
            armor: 0.85,
        },
        priorityOrder: [StatType.STRENGTH, StatType.ARMOR, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: "San'layn build: Haste (favored up to ~30% unbuffed), Crit, Mastery, Versatility. Deathbringer build inverts Haste and Crit, since its damage comes from infrequent procs unaffected by Haste.",
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 6,
        className: 'Death Knight',
        specId: 251,
        specName: 'Frost',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.87,
            haste: 0.83,
            mastery: 0.76,
            versatility: 0.68,
        },
        priorityOrder: [StatType.STRENGTH, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Crit and Haste synergize with Killing Machine, Icy Death Torrent, and The Long Winter. Deathbringer builds should sim, as Haste ranks slightly lower there.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 6,
        className: 'Death Knight',
        specId: 252,
        specName: 'Unholy',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.86,
            mastery: 0.85,
            haste: 0.83,
            versatility: 0.62,
        },
        priorityOrder: [StatType.STRENGTH, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Unholy balances Crit, Mastery, and Haste, which are "significantly better than Versatility" per Icy Veins.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            mastery: 0.88,
            haste: 0.84,
            criticalStrike: 0.80,
            versatility: 0.76,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery now leads, with the rest close together; "150 of your worst stat is often better than 100 of your best" per Icy Veins, so sim your own gear for precise weights.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 7,
        className: 'Shaman',
        specId: 263,
        specName: 'Enhancement',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            criticalStrike: 0.89,
            haste: 0.78,
            versatility: 0.55,
        },
        priorityOrder: [StatType.AGILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Stormbringer build: Mastery and Crit are "neck and neck" ahead of Haste and Versatility. Totemic build swaps Crit and Haste order. Haste wants a ~15-20% floor but no more.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-23',
        patch: '12.1.0',
    },

    {
        classId: 7,
        className: 'Shaman',
        specId: 264,
        specName: 'Restoration',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            criticalStrike: 0.86,
            versatility: 0.80,
            haste: 0.74,
            mastery: 0.66,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.HASTE, StatType.MASTERY],
        notes: 'Haste is strong in Mythic+ and short fights but drains mana faster in long fights; Mastery gains value in progression content where targets frequently drop to low health.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            haste: 0.88,
            criticalStrike: 0.84,
            mastery: 0.80,
            versatility: 0.78,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'All non-Intellect secondaries are very close in value despite the ordering; sim tools such as Raidbots Top Gear are recommended over this generalized list.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 8,
        className: 'Mage',
        specId: 63,
        specName: 'Fire',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.86,
            mastery: 0.83,
            versatility: 0.81,
            criticalStrike: 0.70,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY, StatType.CRITICAL_STRIKE],
        notes: 'Haste now leads with Mastery and Versatility close behind; Critical Strike underperforms relative to the other secondaries.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 8,
        className: 'Mage',
        specId: 64,
        specName: 'Frost',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.86,
            criticalStrike: 0.83,
            haste: 0.80,
            versatility: 0.72,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'The Shatter crit soft cap is gone in Midnight ("a relic of a bygone era" per Icy Veins) - Crit behaves as a normal stat now. At higher gear, Mastery/Crit/Haste trend toward roughly equal weight.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            haste: 0.90,
            criticalStrike: 0.84,
            mastery: 0.80,
            versatility: 0.76,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste leads for dot tick rate and shard generation. Icy Veins notes secondaries are relatively close, so prioritizing item level is generally the better approach.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 9,
        className: 'Warlock',
        specId: 266,
        specName: 'Demonology',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.86,
            criticalStrike: 0.83,
            mastery: 0.80,
            versatility: 0.76,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste to ~22% is an early target, then a balanced Crit/Mastery/Haste/Versatility spread; a more even distribution beats stacking only the top two due to fast-onset diminishing returns.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 9,
        className: 'Warlock',
        specId: 267,
        specName: 'Destruction',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.86,
            criticalStrike: 0.83,
            mastery: 0.80,
            versatility: 0.76,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste to ~22% is an early target, then Crit, Mastery, and Versatility; secondaries are relatively close so item level remains the primary driver.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            criticalStrike: 0.83,
            versatility: 0.80,
            mastery: 0.74,
            haste: 0.68,
            armor: 0.85,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY, StatType.HASTE],
        notes: 'Defensive priority is Critical Strike, Versatility, Mastery, Haste, unchanged across the Shado-Pan and Master of Harmony hero trees. Item level generally matters more than chasing a specific secondary.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 10,
        className: 'Monk',
        specId: 270,
        specName: 'Mistweaver',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            haste: 0.86,
            criticalStrike: 0.84,
            versatility: 0.78,
            mastery: 0.68,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY, StatType.MASTERY],
        notes: 'Same order for raid and Mythic+: Haste, Critical Strike, Versatility, Mastery. Crit generates Mana Tea stacks in addition to raw throughput; high-key pushing favors pairing Haste with Versatility instead.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 10,
        className: 'Monk',
        specId: 269,
        specName: 'Windwalker',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            haste: 0.85,
            criticalStrike: 0.83,
            mastery: 0.81,
            versatility: 0.76,
        },
        priorityOrder: [StatType.AGILITY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Haste, Critical Strike, and Mastery are all very close and can swap order depending on current gear; sim your character rather than following this rigidly.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-11',
        patch: '12.1.0',
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
            mastery: 0.88,
            haste: 0.84,
            criticalStrike: 0.80,
            versatility: 0.72,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: "Mastery leads for both Elune's Chosen (Haste next) and Keeper of the Grove (Critical Strike next) builds, since it amplifies Nature/Arcane damage including DoTs.",
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 103,
        specName: 'Feral',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.86,
            haste: 0.84,
            criticalStrike: 0.82,
            versatility: 0.68,
        },
        priorityOrder: [StatType.AGILITY, StatType.MASTERY, StatType.HASTE, StatType.CRITICAL_STRIKE, StatType.VERSATILITY],
        notes: 'Mastery, Haste, and Crit are very similar and should be kept balanced; Mastery is favored for its Potion of Recklessness synergy. Versatility trails and should be minimized due to Venomcursed item interactions.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 104,
        specName: 'Guardian',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.84,
            versatility: 0.80,
            mastery: 0.72,
            criticalStrike: 0.66,
            armor: 0.88,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.HASTE, StatType.VERSATILITY, StatType.MASTERY, StatType.CRITICAL_STRIKE],
        notes: 'Survivability priority: Haste, Versatility, Mastery, Critical Strike (all secondaries close in value). A damage-focused build swaps Mastery and Critical Strike.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 11,
        className: 'Druid',
        specId: 105,
        specName: 'Restoration',
        contentType: ContentType.HEALER,
        weights: {
            primaryStat: 1.00,
            haste: 0.87,
            mastery: 0.80,
            versatility: 0.76,
            criticalStrike: 0.68,
        },
        priorityOrder: [StatType.INTELLECT, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY, StatType.CRITICAL_STRIKE],
        notes: 'Raid priority: Haste, Mastery, Versatility, Critical Strike. Dungeon healing swaps Haste and Mastery. No universal weights - values shift with gear, content, and spell choices.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            criticalStrike: 0.87,
            mastery: 0.85,
            haste: 0.78,
            versatility: 0.58,
        },
        priorityOrder: [StatType.AGILITY, StatType.CRITICAL_STRIKE, StatType.MASTERY, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Know Your Enemy builds emphasize Critical Strike; Mastery is a close second as it multiplies most of Havoc\'s strongest abilities. Haste improved in Season 2 but stays behind both; Versatility is "noticeably worse" than the rest.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 12,
        className: 'Demon Hunter',
        specId: 581,
        specName: 'Vengeance',
        contentType: ContentType.TANK,
        weights: {
            primaryStat: 1.00,
            haste: 0.84,
            mastery: 0.80,
            versatility: 0.76,
            criticalStrike: 0.68,
            armor: 0.80,
        },
        priorityOrder: [StatType.AGILITY, StatType.ARMOR, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY, StatType.CRITICAL_STRIKE],
        notes: 'No fixed breakpoints; the guide recommends simming for damage while keeping a roughly equal secondary spread for survivability, with Haste, Mastery, Versatility, Critical Strike as the general order.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-26',
        patch: '12.1.0',
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
            criticalStrike: 0.87,
            haste: 0.84,
            mastery: 0.80,
            versatility: 0.72,
        },
        priorityOrder: [StatType.INTELLECT, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.MASTERY, StatType.VERSATILITY],
        notes: 'Item level outweighs secondary optimization except for jewelry/trinkets; secondaries diminish past ~30% rating thresholds, so simming is recommended for precise values.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
            criticalStrike: 0.83,
            haste: 0.78,
            versatility: 0.70,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'Mastery provides the largest healing increase and remains the top priority regardless of Chronowarden/Flameshaper build or content type; Mythic+ allows some flexibility toward damage stats once healing needs are met.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
    },

    {
        classId: 13,
        className: 'Evoker',
        specId: 1473,
        specName: 'Augmentation',
        contentType: ContentType.RAID_DPS,
        weights: {
            primaryStat: 1.00,
            mastery: 0.90,
            criticalStrike: 0.82,
            haste: 0.80,
            versatility: 0.68,
        },
        priorityOrder: [StatType.INTELLECT, StatType.MASTERY, StatType.CRITICAL_STRIKE, StatType.HASTE, StatType.VERSATILITY],
        notes: 'IMPORTANT: Do NOT use stat weight sims for Augmentation - priorities vary significantly by fight. Mastery dominates until ~1840 rating, after which Crit and Haste become roughly equal to it; Chronowarden builds favor Crit slightly over Haste since Double-time lets crits amplify Ebon Might/Prescience by 50%.',
        source: 'Icy Veins 12.1',
        updatedDate: '2026-08-10',
        patch: '12.1.0',
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
