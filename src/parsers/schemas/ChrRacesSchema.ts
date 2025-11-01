/**
 * ChrRacesSchema.ts
 *
 * Schema parser for ChrRaces.db2 (WoW 11.2 - The War Within)
 * Defines all playable character races with properties, models, and configuration.
 *
 * Based on TrinityCore DB2Structure.h:833 and DB2LoadInfo.h:1161
 * Total Fields: 62
 *
 * Week 5: Phase 3.1 - Extended DB2 File Schemas
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Races Enumeration
 * WoW character race IDs
 */
export enum Races {
  RACE_NONE = 0,

  // Classic Races (1-11)
  RACE_HUMAN = 1, // Alliance
  RACE_ORC = 2, // Horde
  RACE_DWARF = 3, // Alliance
  RACE_NIGHTELF = 4, // Alliance
  RACE_UNDEAD_PLAYER = 5, // Horde
  RACE_TAUREN = 6, // Horde
  RACE_GNOME = 7, // Alliance
  RACE_TROLL = 8, // Horde
  RACE_GOBLIN = 9, // Horde
  RACE_BLOODELF = 10, // Horde
  RACE_DRAENEI = 11, // Alliance

  // Cataclysm (22)
  RACE_WORGEN = 22, // Alliance

  // Mists of Pandaria (24-26)
  RACE_PANDAREN_NEUTRAL = 24, // Neutral - Starting race
  RACE_PANDAREN_ALLIANCE = 25, // Alliance - After choosing faction
  RACE_PANDAREN_HORDE = 26, // Horde - After choosing faction

  // Battle for Azeroth Allied Races (27-32, 34-37)
  RACE_NIGHTBORNE = 27, // Horde - Allied Race
  RACE_HIGHMOUNTAIN_TAUREN = 28, // Horde - Allied Race
  RACE_VOID_ELF = 29, // Alliance - Allied Race
  RACE_LIGHTFORGED_DRAENEI = 30, // Alliance - Allied Race
  RACE_ZANDALARI_TROLL = 31, // Horde - Allied Race
  RACE_KUL_TIRAN = 32, // Alliance - Allied Race
  RACE_DARK_IRON_DWARF = 34, // Alliance - Allied Race (RaceMask bit 11)
  RACE_VULPERA = 35, // Horde - Allied Race (RaceMask bit 12)
  RACE_MAGHAR_ORC = 36, // Horde - Allied Race (RaceMask bit 13)
  RACE_MECHAGNOME = 37, // Alliance - Allied Race (RaceMask bit 14)

  // Dragonflight (52, 70)
  RACE_DRACTHYR_ALLIANCE = 52, // Alliance - Evoker only (RaceMask bit 16)
  RACE_DRACTHYR_HORDE = 70, // Horde - Evoker only (RaceMask bit 15)

  // The War Within (84-85)
  RACE_EARTHEN_DWARF_HORDE = 84, // Horde - New in 11.2 (RaceMask bit 17)
  RACE_EARTHEN_DWARF_ALLIANCE = 85, // Alliance - New in 11.2 (RaceMask bit 18)

  MAX_RACES = 88,
}

/**
 * TeamId Enumeration
 * Faction affiliation (Alliance, Horde, Neutral)
 */
export enum TeamId {
  TEAM_ALLIANCE = 0, // Alliance faction
  TEAM_HORDE = 1, // Horde faction
  TEAM_NEUTRAL = 2, // Neutral faction
}

/**
 * ChrRacesFlag Enumeration
 * Race feature flags (bitfield)
 */
export enum ChrRacesFlag {
  NPCOnly = 0x000001, // Race is NPC-only, not playable
  DoNotComponentFeet = 0x000002, // Don't show feet in armor
  CanMount = 0x000004, // Race can use mounts
  HasBald = 0x000008, // Race has bald hairstyle option
  BindToStartingArea = 0x000010, // Bind to starting zone on creation
  AlternateForm = 0x000020, // Has alternate form (e.g., Worgen human form)
  CanMountSelf = 0x000040, // Can mount themselves (Dracthyr visage form)
  ForceToHDModelIfAvailable = 0x000080, // Force high-definition models
  ExaltedWithAllVendors = 0x000100, // Start exalted with faction vendors
  NotSelectable = 0x000200, // Not selectable in character creation
  ReputationBonus = 0x000400, // Reputation gain bonus
  UseLoincloth = 0x000800, // Use loincloth armor piece
  RestBonus = 0x001000, // Bonus rest XP accumulation
  NoStartKits = 0x002000, // Don't receive starting gear
  NoStartingWeapon = 0x004000, // Don't receive starting weapon
  DontRedeemAccountLicenses = 0x008000, // Don't redeem account licenses (trial characters)
  SkinVariationIsHairColor = 0x010000, // Skin variation controls hair color
  UsePandarenRingForComponentingTexture = 0x020000, // Use Pandaren texture ring
  IgnoreForAssetManifestComponentInfoParsing = 0x040000, // Skip asset manifest parsing
  IsAlliedRace = 0x080000, // Is an Allied Race
  VoidVendorDiscount = 0x100000, // Discount from Void vendors
  DAMMComponentNoMaleGeneration = 0x200000, // DAMM: Don't generate male customization
  DAMMComponentNoFemaleGeneration = 0x400000, // DAMM: Don't generate female customization
  NoAssociatedFactionReputationInRaceChange = 0x800000, // Don't change faction reputation on race change
  InternalOnly = 0x1000000, // Internal use only (not playable)
}

/**
 * ChrRaces.db2 Entry Interface
 * Complete character race definition with 62 fields
 */
export interface ChrRacesEntry {
  // Field 0
  id: number; // Race ID (1=Human, 2=Orc, etc.)

  // Fields 1-2 (Non-localized strings)
  clientPrefix: string; // Race file prefix (e.g., "hu" for human)
  clientFileString: string; // Client file path string

  // Fields 3-15 (Localized strings - simplified to single string for MVP)
  name: string; // Race name (male)
  nameFemale: string; // Race name (female)
  nameLowercase: string; // Lowercase race name (male)
  nameFemaleLowercase: string; // Lowercase race name (female)
  loreName: string; // Lore-friendly race name
  loreNameFemale: string; // Lore-friendly race name (female)
  loreNameLower: string; // Lowercase lore name
  loreNameLowerFemale: string; // Lowercase lore name (female)
  loreDescription: string; // Race lore description
  shortName: string; // Short race name
  shortNameFemale: string; // Short race name (female)
  shortNameLower: string; // Lowercase short name
  shortNameLowerFemale: string; // Lowercase short name (female)

  // Fields 16-34 (Int32 fields)
  flags: number; // ChrRacesFlag bitmask
  factionID: number; // Starting faction (references Faction.db2)
  cinematicSequenceID: number; // Intro cinematic ID
  resSicknessSpellID: number; // Resurrection sickness spell ID
  splashSoundID: number; // Water splash sound ID
  createScreenFileDataID: number; // Character creation screen background
  selectScreenFileDataID: number; // Character selection screen background
  lowResScreenFileDataID: number; // Low-resolution screen background
  alteredFormStartVisualKitID: number[]; // [3] Visual kit IDs for form transformation start
  alteredFormFinishVisualKitID: number[]; // [3] Visual kit IDs for form transformation finish
  heritageArmorAchievementID: number; // Heritage armor unlock achievement
  startingLevel: number; // Starting character level
  uiDisplayOrder: number; // UI display order in character creation
  playableRaceBit: number; // RaceMask bit position (0-18, NOT race ID!)
  transmogrifyDisabledSlotMask: number; // Equipment slots disabled for transmog

  // Fields 35-44 (Float fields)
  alteredFormCustomizeOffsetFallback: number[]; // [3] Fallback customization offset (X,Y,Z)
  alteredFormCustomizeRotationFallback: number; // Fallback customization rotation
  unknown910_1: number[]; // [3] Unknown (added in 9.1.0+)
  unknown910_2: number[]; // [3] Unknown (added in 9.1.0+)

  // Fields 45-61 (Byte fields)
  baseLanguage: number; // Base language ID (int8)
  creatureType: number; // Creature type (Humanoid, Beast, etc.) (uint8)
  alliance: number; // Alliance affiliation (int8: 0=Horde, 1=Alliance, 2=Neutral)
  raceRelated: number; // Related race ID (int8)
  unalteredVisualRaceID: number; // Visual race for base form (int8)
  defaultClassID: number; // Default/recommended class (int8)
  neutralRaceID: number; // Neutral version of race (for Pandaren) (int8)
  maleModelFallbackRaceID: number; // Fallback race for male models (int8)
  maleModelFallbackSex: number; // Fallback sex for male models (int8)
  femaleModelFallbackRaceID: number; // Fallback race for female models (int8)
  femaleModelFallbackSex: number; // Fallback sex for female models (int8)
  maleTextureFallbackRaceID: number; // Fallback race for male textures (int8)
  maleTextureFallbackSex: number; // Fallback sex for male textures (int8)
  femaleTextureFallbackRaceID: number; // Fallback race for female textures (int8)
  femaleTextureFallbackSex: number; // Fallback sex for female textures (int8)
  helmetAnimScalingRaceID: number; // Race ID for helmet animation scaling (int8)
  unalteredVisualCustomizationRaceID: number; // Race ID for unaltered visual customization (int8)
}

/**
 * ChrRaces.db2 Schema Parser
 */
export class ChrRacesSchema {
  /**
   * Convert uint8 to int8 (signed byte)
   * @param value Unsigned 8-bit value
   * @returns Signed 8-bit value
   */
  private static convertToInt8(value: number): number {
    // Convert unsigned byte to signed byte (-128 to 127)
    return value > 127 ? value - 256 : value;
  }

  /**
   * Parse ChrRaces.db2 record
   * @param record DB2 record to parse
   * @returns Parsed ChrRacesEntry
   */
  public static parse(record: DB2Record): ChrRacesEntry {
    // NOTE: Actual field order may vary - this is based on TrinityCore's structure
    // Field indices derived from DB2Structure.h and DB2LoadInfo.h

    return {
      // Field 0
      id: record.getUInt32(0),

      // Fields 1-2 (Non-localized strings)
      clientPrefix: record.getString(1),
      clientFileString: record.getString(2),

      // Fields 3-15 (Localized strings - using first locale for MVP)
      name: record.getString(3),
      nameFemale: record.getString(4),
      nameLowercase: record.getString(5),
      nameFemaleLowercase: record.getString(6),
      loreName: record.getString(7),
      loreNameFemale: record.getString(8),
      loreNameLower: record.getString(9),
      loreNameLowerFemale: record.getString(10),
      loreDescription: record.getString(11),
      shortName: record.getString(12),
      shortNameFemale: record.getString(13),
      shortNameLower: record.getString(14),
      shortNameLowerFemale: record.getString(15),

      // Fields 16-34 (Int32 fields)
      flags: record.getInt32(16),
      factionID: record.getInt32(17),
      cinematicSequenceID: record.getInt32(18),
      resSicknessSpellID: record.getInt32(19),
      splashSoundID: record.getInt32(20),
      createScreenFileDataID: record.getInt32(21),
      selectScreenFileDataID: record.getInt32(22),
      lowResScreenFileDataID: record.getInt32(23),
      alteredFormStartVisualKitID: [
        record.getInt32(24),
        record.getInt32(25),
        record.getInt32(26),
      ],
      alteredFormFinishVisualKitID: [
        record.getInt32(27),
        record.getInt32(28),
        record.getInt32(29),
      ],
      heritageArmorAchievementID: record.getInt32(30),
      startingLevel: record.getInt32(31),
      uiDisplayOrder: record.getInt32(32),
      playableRaceBit: record.getInt32(33),
      transmogrifyDisabledSlotMask: record.getInt32(34),

      // Fields 35-44 (Float fields)
      alteredFormCustomizeOffsetFallback: [
        record.getFloat(35),
        record.getFloat(36),
        record.getFloat(37),
      ],
      alteredFormCustomizeRotationFallback: record.getFloat(38),
      unknown910_1: [record.getFloat(39), record.getFloat(40), record.getFloat(41)],
      unknown910_2: [record.getFloat(42), record.getFloat(43), record.getFloat(44)],

      // Fields 45-61 (Byte fields)
      baseLanguage: this.convertToInt8(record.getUInt8(45)),
      creatureType: record.getUInt8(46),
      alliance: this.convertToInt8(record.getUInt8(47)),
      raceRelated: this.convertToInt8(record.getUInt8(48)),
      unalteredVisualRaceID: this.convertToInt8(record.getUInt8(49)),
      defaultClassID: this.convertToInt8(record.getUInt8(50)),
      neutralRaceID: this.convertToInt8(record.getUInt8(51)),
      maleModelFallbackRaceID: this.convertToInt8(record.getUInt8(52)),
      maleModelFallbackSex: this.convertToInt8(record.getUInt8(53)),
      femaleModelFallbackRaceID: this.convertToInt8(record.getUInt8(54)),
      femaleModelFallbackSex: this.convertToInt8(record.getUInt8(55)),
      maleTextureFallbackRaceID: this.convertToInt8(record.getUInt8(56)),
      maleTextureFallbackSex: this.convertToInt8(record.getUInt8(57)),
      femaleTextureFallbackRaceID: this.convertToInt8(record.getUInt8(58)),
      femaleTextureFallbackSex: this.convertToInt8(record.getUInt8(59)),
      helmetAnimScalingRaceID: this.convertToInt8(record.getUInt8(60)),
      unalteredVisualCustomizationRaceID: this.convertToInt8(record.getUInt8(61)),
    };
  }

  /**
   * Get race name by ID
   * @param raceID Race ID (Races enum)
   * @returns Race name string
   */
  public static getRaceName(raceID: number): string {
    const raceNames: Record<number, string> = {
      1: 'Human',
      2: 'Orc',
      3: 'Dwarf',
      4: 'Night Elf',
      5: 'Undead',
      6: 'Tauren',
      7: 'Gnome',
      8: 'Troll',
      9: 'Goblin',
      10: 'Blood Elf',
      11: 'Draenei',
      22: 'Worgen',
      24: 'Pandaren',
      25: 'Pandaren',
      26: 'Pandaren',
      27: 'Nightborne',
      28: 'Highmountain Tauren',
      29: 'Void Elf',
      30: 'Lightforged Draenei',
      31: 'Zandalari Troll',
      32: 'Kul Tiran',
      34: 'Dark Iron Dwarf',
      35: 'Vulpera',
      36: "Mag'har Orc",
      37: 'Mechagnome',
      52: 'Dracthyr',
      70: 'Dracthyr',
      84: 'Earthen',
      85: 'Earthen',
    };
    return raceNames[raceID] || 'Unknown';
  }

  /**
   * Get faction affiliation for race
   * @param entry ChrRacesEntry
   * @returns TeamId (Alliance/Horde/Neutral)
   */
  public static getFaction(entry: ChrRacesEntry): TeamId {
    return entry.alliance as TeamId;
  }

  /**
   * Get faction name
   * @param faction TeamId
   * @returns Faction name string
   */
  public static getFactionName(faction: TeamId): string {
    const factionNames: Record<number, string> = {
      [TeamId.TEAM_ALLIANCE]: 'Alliance',
      [TeamId.TEAM_HORDE]: 'Horde',
      [TeamId.TEAM_NEUTRAL]: 'Neutral',
    };
    return factionNames[faction] || 'Unknown';
  }

  /**
   * Check if race has specific flag
   * @param entry ChrRacesEntry
   * @param flag ChrRacesFlag enum value
   * @returns True if flag is set
   */
  public static hasFlag(entry: ChrRacesEntry, flag: ChrRacesFlag): boolean {
    return !!(entry.flags & flag);
  }

  /**
   * Check if race is playable (not NPC-only or not selectable)
   * @param entry ChrRacesEntry
   * @returns True if playable
   */
  public static isPlayable(entry: ChrRacesEntry): boolean {
    return (
      !this.hasFlag(entry, ChrRacesFlag.NPCOnly) &&
      !this.hasFlag(entry, ChrRacesFlag.NotSelectable) &&
      !this.hasFlag(entry, ChrRacesFlag.InternalOnly)
    );
  }

  /**
   * Check if race is an Allied Race
   * @param entry ChrRacesEntry
   * @returns True if allied race
   */
  public static isAlliedRace(entry: ChrRacesEntry): boolean {
    return this.hasFlag(entry, ChrRacesFlag.IsAlliedRace);
  }

  /**
   * Check if race has alternate form (Worgen, Dracthyr)
   * @param entry ChrRacesEntry
   * @returns True if has alternate form
   */
  public static hasAlternateForm(entry: ChrRacesEntry): boolean {
    return this.hasFlag(entry, ChrRacesFlag.AlternateForm);
  }

  /**
   * Check if race can mount
   * @param entry ChrRacesEntry
   * @returns True if can use mounts
   */
  public static canMount(entry: ChrRacesEntry): boolean {
    return this.hasFlag(entry, ChrRacesFlag.CanMount);
  }

  /**
   * Check if race ID is valid (not RACE_NONE)
   * @param raceID Race ID
   * @returns True if valid race
   */
  public static isValidRace(raceID: number): boolean {
    return raceID > Races.RACE_NONE && raceID < Races.MAX_RACES;
  }

  /**
   * Get all Alliance race IDs
   * @returns Array of Alliance race IDs
   */
  public static getAllianceRaces(): number[] {
    return [
      Races.RACE_HUMAN,
      Races.RACE_DWARF,
      Races.RACE_NIGHTELF,
      Races.RACE_GNOME,
      Races.RACE_DRAENEI,
      Races.RACE_WORGEN,
      Races.RACE_PANDAREN_ALLIANCE,
      Races.RACE_VOID_ELF,
      Races.RACE_LIGHTFORGED_DRAENEI,
      Races.RACE_KUL_TIRAN,
      Races.RACE_DARK_IRON_DWARF,
      Races.RACE_MECHAGNOME,
      Races.RACE_DRACTHYR_ALLIANCE,
      Races.RACE_EARTHEN_DWARF_ALLIANCE,
    ];
  }

  /**
   * Get all Horde race IDs
   * @returns Array of Horde race IDs
   */
  public static getHordeRaces(): number[] {
    return [
      Races.RACE_ORC,
      Races.RACE_UNDEAD_PLAYER,
      Races.RACE_TAUREN,
      Races.RACE_TROLL,
      Races.RACE_GOBLIN,
      Races.RACE_BLOODELF,
      Races.RACE_PANDAREN_HORDE,
      Races.RACE_NIGHTBORNE,
      Races.RACE_HIGHMOUNTAIN_TAUREN,
      Races.RACE_ZANDALARI_TROLL,
      Races.RACE_VULPERA,
      Races.RACE_MAGHAR_ORC,
      Races.RACE_DRACTHYR_HORDE,
      Races.RACE_EARTHEN_DWARF_HORDE,
    ];
  }
}

/**
 * CharBaseInfo.db2 Entry Interface
 * Maps valid race/class combinations
 */
export interface CharBaseInfoEntry {
  id: number; // Unique ID
  raceID: number; // Race ID (references ChrRaces.db2)
  classID: number; // Class ID (references ChrClasses.db2)
  otherFactionRaceID: number; // Opposite faction equivalent race
}

/**
 * CharBaseInfo.db2 Schema Parser
 */
export class CharBaseInfoSchema {
  /**
   * Convert uint8 to int8 (signed byte)
   * @param value Unsigned 8-bit value
   * @returns Signed 8-bit value
   */
  private static convertToInt8(value: number): number {
    return value > 127 ? value - 256 : value;
  }

  /**
   * Parse CharBaseInfo.db2 record
   * @param record DB2 record to parse
   * @returns Parsed CharBaseInfoEntry
   */
  public static parse(record: DB2Record): CharBaseInfoEntry {
    return {
      id: record.getUInt32(0),
      raceID: this.convertToInt8(record.getUInt8(1)),
      classID: this.convertToInt8(record.getUInt8(2)),
      otherFactionRaceID: this.convertToInt8(record.getUInt8(3)),
    };
  }
}
