/**
 * Item.db2 and ItemSparse.db2 Schema for WoW 12.0 (Midnight)
 * Based on TrinityCore's ItemTemplate structure
 * Source: src/server/game/Entities/Item/ItemTemplate.h
 */

import { DB2Record } from '../db2/DB2Record';
import {
  DB2FieldType,
  DB2SparseFieldLayout,
  registerSparseFieldLayout,
} from '../db2/DB2FieldLayout';

/**
 * Item Quality (Rarity)
 */
export enum ItemQuality {
  POOR = 0, // Gray
  COMMON = 1, // White
  UNCOMMON = 2, // Green
  RARE = 3, // Blue
  EPIC = 4, // Purple
  LEGENDARY = 5, // Orange
  ARTIFACT = 6, // Light Yellow/Gold
  HEIRLOOM = 7, // Light Blue
  WOW_TOKEN = 8, // Light Blue (token)
}

/**
 * Item Bonding Type
 */
export enum ItemBondingType {
  BIND_NONE = 0,
  BIND_ON_ACQUIRE = 1,
  BIND_ON_EQUIP = 2,
  BIND_ON_USE = 3,
  BIND_QUEST = 4,
  BIND_WOW_ACCOUNT = 7,
  BIND_BNET_ACCOUNT = 8,
  BIND_BNET_ACCOUNT_UNTIL_EQUIPPED = 9,
}

/**
 * Inventory Type (Equipment Slot)
 */
export enum InventoryType {
  NON_EQUIP = 0,
  HEAD = 1,
  NECK = 2,
  SHOULDERS = 3,
  BODY = 4,
  CHEST = 5,
  WAIST = 6,
  LEGS = 7,
  FEET = 8,
  WRISTS = 9,
  HANDS = 10,
  FINGER = 11,
  TRINKET = 12,
  WEAPON = 13,
  SHIELD = 14,
  RANGED = 15,
  CLOAK = 16,
  WEAPON_2H = 17,
  BAG = 18,
  TABARD = 19,
  ROBE = 20,
  WEAPON_MAINHAND = 21,
  WEAPON_OFFHAND = 22,
  HOLDABLE = 23,
  AMMO = 24,
  THROWN = 25,
  RANGED_RIGHT = 26,
  QUIVER = 27,
  RELIC = 28,
  PROFESSION_TOOL = 29,
  PROFESSION_GEAR = 30,
  EQUIPABLE_SPELL_OFFENSIVE = 31,
  EQUIPABLE_SPELL_UTILITY = 32,
  EQUIPABLE_SPELL_DEFENSIVE = 33,
  EQUIPABLE_SPELL_MOBILITY = 34,
}

/**
 * Item Class
 */
export enum ItemClass {
  CONSUMABLE = 0,
  CONTAINER = 1,
  WEAPON = 2,
  GEM = 3,
  ARMOR = 4,
  REAGENT = 5,
  PROJECTILE = 6,
  TRADE_GOODS = 7,
  ITEM_ENHANCEMENT = 8,
  RECIPE = 9,
  MONEY = 10, // OBSOLETE
  QUIVER = 11,
  QUEST = 12,
  KEY = 13,
  PERMANENT = 14, // OBSOLETE
  MISCELLANEOUS = 15,
  GLYPH = 16,
  BATTLE_PETS = 17,
  WOW_TOKEN = 18,
  PROFESSION = 19,
}

/**
 * Item Mod Type (Stats)
 */
export enum ItemModType {
  MANA = 0,
  HEALTH = 1,
  AGILITY = 3,
  STRENGTH = 4,
  INTELLECT = 5,
  SPIRIT = 6,
  STAMINA = 7,
  DEFENSE_SKILL_RATING = 12,
  DODGE_RATING = 13,
  PARRY_RATING = 14,
  BLOCK_RATING = 15,
  HIT_MELEE_RATING = 16,
  HIT_RANGED_RATING = 17,
  HIT_SPELL_RATING = 18,
  CRIT_MELEE_RATING = 19,
  CRIT_RANGED_RATING = 20,
  CRIT_SPELL_RATING = 21,
  CORRUPTION = 22,
  CORRUPTION_RESISTANCE = 23,
  CRIT_TAKEN_RANGED_RATING = 26,
  CRIT_TAKEN_SPELL_RATING = 27,
  HASTE_MELEE_RATING = 28,
  HASTE_RANGED_RATING = 29,
  HASTE_SPELL_RATING = 30,
  HIT_RATING = 31,
  CRIT_RATING = 32,
  HIT_TAKEN_RATING = 33,
  CRIT_TAKEN_RATING = 34,
  RESILIENCE_RATING = 35,
  HASTE_RATING = 36,
  EXPERTISE_RATING = 37,
  ATTACK_POWER = 38,
  RANGED_ATTACK_POWER = 39,
  VERSATILITY = 40,
  SPELL_HEALING_DONE = 41,
  SPELL_DAMAGE_DONE = 42,
  MANA_REGENERATION = 43,
  ARMOR_PENETRATION_RATING = 44,
  SPELL_POWER = 45,
  HEALTH_REGEN = 46,
  SPELL_PENETRATION = 47,
  BLOCK_VALUE = 48,
  MASTERY_RATING = 49,
  EXTRA_ARMOR = 50,
  FIRE_RESISTANCE = 51,
  FROST_RESISTANCE = 52,
  HOLY_RESISTANCE = 53,
  SHADOW_RESISTANCE = 54,
  NATURE_RESISTANCE = 55,
  ARCANE_RESISTANCE = 56,
  PVP_POWER = 57,
  CR_SPEED = 61,
  CR_LIFESTEAL = 62,
  CR_AVOIDANCE = 63,
  CR_STURDINESS = 64,
  AGI_STR_INT = 71,
  AGI_STR = 72,
  AGI_INT = 73,
  STR_INT = 74,
}

/**
 * Item Spell Trigger Type
 */
export enum ItemSpellTriggerType {
  ON_USE = 0, // Use after equip cooldown
  ON_EQUIP = 1,
  ON_PROC = 2,
  SUMMONED_BY_SPELL = 3,
  ON_DEATH = 4,
  ON_PICKUP = 5,
  ON_LEARN = 6,
  ON_LOOTED = 7,
  TEACH_MOUNT = 8,
  ON_PICKUP_FORCED = 9,
  ON_LOOTED_FORCED = 10,
}

/**
 * Item Stat (ItemMod)
 * Represents a single stat modifier on an item
 */
export interface ItemStat {
  type: ItemModType; // Stat type (Strength, Crit, etc.)
  value: number; // Stat value, as a percentage editor value
  socketPercentage: number; // Share of the stat contributed by sockets
}

/**
 * Item Basic Entry (Item.db2)
 * Core item identification data
 */
export interface ItemEntry {
  id: number; // Item ID - from the ID table, not an inline field
  classId: number; // Item class (ItemClass enum)
  subclassId: number; // Item subclass (varies by class)
  material: number; // Item material
  inventoryType: number; // Equipment slot (InventoryType)
  sheatheType: number; // How the item is sheathed
  soundOverrideSubclassId: number; // Sound override (signed)
  iconFileDataId: number; // Icon file data ID
  itemGroupSoundsId: number; // Sound group ID
  contentTuningId: number; // Content tuning ID
  modifiedCraftingReagentItemId: number; // Modified crafting reagent
  craftingQualityId: number; // Crafting quality
  itemSquishEraId: number; // Item squish era
  recraftReagentCountPercentage: number; // Recraft reagent count percentage
  orderSource: number; // Order source
}

/**
 * Item Sparse Entry (ItemSparse.db2)
 * Extended item data with stats, requirements, etc.
 */
export interface ItemSparseEntry {
  /** Item ID. Held by the catalog, not by the record: the column is noninline. */
  id: number;

  // Localized text. Only one locale is present per DB2 file.
  /** Item name. Named Display_lang in the client definition. */
  name: string;
  /** Flavour text shown under the name. */
  description: string;
  /** Additional display strings, unused by most items. */
  display1: string;
  display2: string;
  display3: string;

  // Pricing
  buyPrice: number; // Vendor buy price in copper
  sellPrice: number; // Vendor sell price in copper
  priceVariance: number; // Price variance multiplier
  priceRandomValue: number; // Price random multiplier
  vendorStackCount: number; // Stack size when sold by a vendor

  // Quality and level
  overallQualityId: number; // ItemQuality
  inventoryType: number; // InventoryType, the equipment slot
  itemLevel: number;
  requiredLevel: number;
  expansionId: number;
  itemSquishEraId: number;

  // Requirements
  requiredSkill: number; // Profession skill line
  requiredSkillRank: number;
  requiredAbility: number; // Spell the player must know
  minFactionId: number;
  minReputation: number;
  requiredPvpMedal: number;
  requiredPvpRank: number;
  requiredHoliday: number;
  requiredTransmogHoliday: number;

  // Class and race restrictions
  allowableClass: number; // Class mask, -1 for all classes
  allowableRace: bigint; // Race mask, stored as two int32 halves

  // Stats
  stats: ItemStat[]; // Non-empty entries of the ten stat slots

  // Flags
  flags: number[]; // Five flag words

  // Item level scaling
  contentTuningId: number;
  playerLevelToItemLevelCurveId: number;
  itemLevelOffsetCurveId: number;
  itemLevelOffsetItemLevel: number;

  // Weapon and range
  damageType: number; // Damage school
  itemDelay: number; // Swing speed in milliseconds
  dmgVariance: number;
  itemRange: number;

  // Sockets
  socketTypes: number[]; // Socket colour of each of the three slots, 0 when empty
  socketMatchEnchantmentId: number; // Enchant granted for matching all sockets
  gemProperties: number;

  // Container
  containerSlots: number;
  bagFamily: number;

  // Bonding and stacking
  bonding: number; // ItemBondingType
  stackable: number;
  maxCount: number;
  durationInInventory: number;

  // Appearance
  sheatheType: number;
  material: number;
  artifactId: number;

  // Text pages
  pageId: number;
  pageMaterialId: number;
  languageId: number;

  // Location binding
  instanceBound: number;
  zoneBound: number[]; // Two zone IDs

  // Miscellaneous
  startQuestId: number;
  lockId: number;
  itemSet: number;
  totemCategoryId: number;
  limitCategory: number;
  itemNameDescriptionId: number;
  qualityModifier: number;
  oppositeFactionItemId: number;
  modifiedCraftingReagentItemId: number;
  spellWeight: number;
  spellWeightCategory: number;
}

/**
 * Complete Item Template
 * Combines ItemEntry (basic) and ItemSparseEntry (extended)
 */
export interface ItemTemplate {
  basic: ItemEntry; // Item.db2 data
  extended: ItemSparseEntry; // ItemSparse.db2 data
}

/**
 * Item Schema Parser
 * Parses Item.db2 and ItemSparse.db2 records
 */
export class ItemSchema {
  /** Build range this schema's field indices are known to be correct for. */
  public static readonly VALID_BUILDS: { from: number; to: number | null } = { from: 68209, to: null };

  /** build -> layoutHash. 65299 is the 2025-12-22 extraction, identified as WoW 11.2.7
   *  via WoWDBDefs (11 consistent builds 64438-65299, all sharing these layouts).
   *  Populated by scripts/record-layout-hashes.js. */
  public static readonly LAYOUT_HASHES: Map<number, number> = new Map<number, number>([
    // 12.1 only. The 11.2.7 layout (0x6d1dd0ce) is deliberately NOT listed:
    // these field indices are written for 0x996192aa, so 11.2.7 data must
    // report a mismatch rather than be parsed with the wrong offsets.
    [69497, 0x996192aa],
  ]);

  /** Name used in gate errors and the validate-build-schemas report. */
  public static readonly SCHEMA_NAME = "ItemSchema";

  /**
   * Parse Item.db2 record (basic data)
   * @param record DB2Record from Item.db2
   * @returns Parsed ItemEntry
   */
  public static parseBasic(record: DB2Record): ItemEntry {
    // Field indices follow Item.db2 layout 0x996192AA (WoW 12.1), per WoWDBDefs.
    // ID is $noninline$ - it lives in the ID table, not the record - so the
    // inline fields start at 0 with ClassID. The file confirms this:
    // fieldCount is 15 while the definition lists 16 columns.
    //
    // Verified against hotfixes.item for 111 items: ClassID, SubclassID,
    // Material, InventoryType, SheatheType and IconFileDataID all agree.
    return {
      id: record.getId(),
      classId: record.getUInt32(0),
      subclassId: record.getUInt32(1),
      material: record.getUInt32(2),
      inventoryType: record.getUInt32(3),
      sheatheType: record.getUInt32(4),
      soundOverrideSubclassId: record.getInt32(5),
      iconFileDataId: record.getUInt32(6),
      itemGroupSoundsId: record.getUInt32(7),
      contentTuningId: record.getUInt32(8),
      modifiedCraftingReagentItemId: record.getUInt32(9),
      // field 10 is Field_12_0_0_63534_010, unnamed in WoWDBDefs - skipped
      craftingQualityId: record.getUInt32(11),
      itemSquishEraId: record.getUInt32(12),
      recraftReagentCountPercentage: record.getUInt32(13),
      orderSource: record.getUInt32(14),
    };
  }

  /**
   * Parse an ItemSparse.db2 record.
   *
   * ItemSparse is a sparse file: records are variable length with inline
   * strings, so the loader must walk each record against
   * {@link ItemSparseSchema.FIELD_LAYOUT} before any field can be read. That
   * layout is registered for the file at module load, so a loader opened on
   * ItemSparse.db2 picks it up automatically.
   *
   * Field indices below are the inline field numbers for the 12.1 layout
   * 0x1C17D17F. ID is a noninline column carried by the catalog, so it is read
   * through getId() rather than from a field.
   *
   * @param record Record accessor positioned on an ItemSparse row
   * @returns Parsed item detail
   *
   * @remarks
   * Weapon damage, armour, resistances and item spells are no longer part of
   * ItemSparse. They live in ItemDamage*.db2, ItemArmorTotal.db2 and
   * ItemEffect.db2, so they are absent here rather than reported as zero.
   */
  public static parseSparse(record: DB2Record): ItemSparseEntry {
    // Ten stat slots: a stat type, its value, and the share coming from sockets.
    const stats: ItemStat[] = [];
    for (let i = 0; i < 10; i++) {
      const type = record.getInt32(16, i);
      if (type > 0) {
        stats.push({
          type,
          value: record.getInt32(15, i),
          socketPercentage: record.getFloat(14, i),
        });
      }
    }

    // AllowableRaces is two int32 halves of one 64-bit mask.
    const raceLow = BigInt(record.getInt32(21, 0)) & 0xffffffffn;
    const raceHigh = BigInt(record.getInt32(21, 1)) & 0xffffffffn;

    return {
      id: record.getId(),

      // Localized text (fields 0-4)
      description: record.getString(0),
      display3: record.getString(1),
      display2: record.getString(2),
      display1: record.getString(3),
      name: record.getString(4),

      // Pricing (fields 22-26)
      sellPrice: record.getUInt32(22),
      buyPrice: record.getUInt32(23),
      vendorStackCount: record.getUInt32(24),
      priceVariance: record.getFloat(25),
      priceRandomValue: record.getFloat(26),

      // Quality and level (fields 50, 64-66, 5, 34)
      itemLevel: record.getUInt16(50),
      requiredLevel: record.getInt8(64),
      inventoryType: record.getInt8(65),
      overallQualityId: record.getInt8(66),
      expansionId: record.getInt32(5),
      itemSquishEraId: record.getInt32(34),

      // Requirements (fields 47-49, 20, 19, 62-63, 36-37)
      minFactionId: record.getUInt16(47),
      requiredSkillRank: record.getUInt16(48),
      requiredSkill: record.getUInt16(49),
      requiredAbility: record.getUInt32(20),
      minReputation: record.getInt32(19),
      requiredPvpMedal: record.getUInt8(62),
      requiredPvpRank: record.getInt8(63),
      requiredTransmogHoliday: record.getUInt16(36),
      requiredHoliday: record.getUInt16(37),

      // Class and race (fields 51, 21)
      allowableClass: record.getInt16(51),
      allowableRace: BigInt.asIntN(64, (raceHigh << 32n) | raceLow),

      // Stats (fields 14-16)
      stats,

      // Flags (field 27)
      flags: [
        record.getInt32(27, 0),
        record.getInt32(27, 1),
        record.getInt32(27, 2),
        record.getInt32(27, 3),
        record.getInt32(27, 4),
      ],

      // Item level scaling (fields 30-33)
      contentTuningId: record.getInt32(30),
      playerLevelToItemLevelCurveId: record.getInt32(31),
      itemLevelOffsetCurveId: record.getInt32(32),
      itemLevelOffsetItemLevel: record.getInt32(33),

      // Weapon and range (fields 60, 46, 6, 13)
      damageType: record.getUInt8(60),
      itemDelay: record.getUInt16(46),
      dmgVariance: record.getFloat(6),
      itemRange: record.getFloat(13),

      // Sockets (fields 55, 39, 38)
      socketTypes: [record.getUInt8(55, 0), record.getUInt8(55, 1), record.getUInt8(55, 2)],
      socketMatchEnchantmentId: record.getUInt16(39),
      gemProperties: record.getUInt16(38),

      // Container (fields 61, 10)
      containerSlots: record.getUInt8(61),
      bagFamily: record.getUInt32(10),

      // Bonding and stacking (fields 59, 17, 18, 8)
      bonding: record.getUInt8(59),
      stackable: record.getInt32(17),
      maxCount: record.getInt32(18),
      durationInInventory: record.getUInt32(8),

      // Appearance (fields 56, 57, 52)
      sheatheType: record.getUInt8(56),
      material: record.getUInt8(57),
      artifactId: record.getUInt8(52),

      // Text pages (fields 45, 58, 12)
      pageId: record.getUInt16(45),
      pageMaterialId: record.getUInt8(58),
      languageId: record.getInt32(12),

      // Location binding (fields 41-42)
      instanceBound: record.getUInt16(41),
      zoneBound: [record.getUInt16(42, 0), record.getUInt16(42, 1)],

      // Miscellaneous
      startQuestId: record.getInt32(11),
      lockId: record.getUInt16(44),
      itemSet: record.getUInt16(43),
      totemCategoryId: record.getUInt16(40),
      limitCategory: record.getInt32(7),
      itemNameDescriptionId: record.getUInt16(35),
      qualityModifier: record.getFloat(9),
      oppositeFactionItemId: record.getInt32(28),
      modifiedCraftingReagentItemId: record.getInt32(29),
      spellWeight: record.getUInt8(53),
      spellWeightCategory: record.getUInt8(54),
    };
  }

  /**
   * Combine basic and sparse data into ItemTemplate
   * @param basic ItemEntry from Item.db2
   * @param sparse ItemSparseEntry from ItemSparse.db2
   * @returns Complete ItemTemplate
   */
  public static combine(basic: ItemEntry, sparse: ItemSparseEntry): ItemTemplate {
    return {
      basic,
      extended: sparse,
    };
  }

  /**
   * Check if item is equippable
   * @param item ItemTemplate
   * @returns True if item can be equipped
   */
  public static isEquippable(item: ItemTemplate): boolean {
    return item.extended.inventoryType > InventoryType.NON_EQUIP;
  }

  /**
   * Check if item is a weapon
   * @param item ItemTemplate
   * @returns True if item is a weapon
   */
  public static isWeapon(item: ItemTemplate): boolean {
    return item.basic.classId === ItemClass.WEAPON;
  }

  /**
   * Check if item is armor
   * @param item ItemTemplate
   * @returns True if item is armor
   */
  public static isArmor(item: ItemTemplate): boolean {
    return item.basic.classId === ItemClass.ARMOR;
  }

  /**
   * Check if item is consumable
   * @param item ItemTemplate
   * @returns True if item is consumable
   */
  public static isConsumable(item: ItemTemplate): boolean {
    return item.basic.classId === ItemClass.CONSUMABLE;
  }

  /**
   * Get item quality name
   * @param quality ItemQuality enum value
   * @returns Quality name string
   */
  public static getQualityName(quality: ItemQuality): string {
    const names: Record<ItemQuality, string> = {
      [ItemQuality.POOR]: 'Poor',
      [ItemQuality.COMMON]: 'Common',
      [ItemQuality.UNCOMMON]: 'Uncommon',
      [ItemQuality.RARE]: 'Rare',
      [ItemQuality.EPIC]: 'Epic',
      [ItemQuality.LEGENDARY]: 'Legendary',
      [ItemQuality.ARTIFACT]: 'Artifact',
      [ItemQuality.HEIRLOOM]: 'Heirloom',
      [ItemQuality.WOW_TOKEN]: 'WoW Token',
    };
    return names[quality] || 'Unknown';
  }

  /**
   * Get item quality color (hex)
   * @param quality ItemQuality enum value
   * @returns Hex color code
   */
  public static getQualityColor(quality: ItemQuality): string {
    const colors: Record<ItemQuality, string> = {
      [ItemQuality.POOR]: '#9d9d9d', // Gray
      [ItemQuality.COMMON]: '#ffffff', // White
      [ItemQuality.UNCOMMON]: '#1eff00', // Green
      [ItemQuality.RARE]: '#0070dd', // Blue
      [ItemQuality.EPIC]: '#a335ee', // Purple
      [ItemQuality.LEGENDARY]: '#ff8000', // Orange
      [ItemQuality.ARTIFACT]: '#e6cc80', // Gold
      [ItemQuality.HEIRLOOM]: '#00ccff', // Light Blue
      [ItemQuality.WOW_TOKEN]: '#00ccff', // Light Blue
    };
    return colors[quality] || '#ffffff';
  }

  /**
   * Check if item can be sold to vendor
   * @param item ItemTemplate
   * @returns True if item has sell price
   */
  public static canSellToVendor(item: ItemTemplate): boolean {
    return item.extended.sellPrice > 0;
  }

  /**
   * Check if item is soulbound
   * @param item ItemTemplate
   * @returns True if item is soulbound
   */
  public static isSoulbound(item: ItemTemplate): boolean {
    return (
      item.extended.bonding === ItemBondingType.BIND_ON_ACQUIRE ||
      item.extended.bonding === ItemBondingType.BIND_ON_EQUIP
    );
  }

  /**
   * Get total primary stat value
   * @param item ItemTemplate
   * @returns Sum of primary stats (Str/Agi/Int)
   */
  public static getPrimaryStatValue(item: ItemTemplate): number {
    let total = 0;
    for (const stat of item.extended.stats) {
      if (
        stat.type === ItemModType.STRENGTH ||
        stat.type === ItemModType.AGILITY ||
        stat.type === ItemModType.INTELLECT
      ) {
        total += stat.value;
      }
    }
    return total;
  }

}

/**
 * ItemSparse.db2 Build Declaration
 *
 * ItemSparse.db2 is a separate DB2 file from Item.db2 with its own layout
 * hash. The parsing logic for it lives in ItemSchema.parseSparse() above
 * (both files' parsers are kept together per the module's original
 * design), but the hard-coded field indices in parseSparse() are only
 * valid for ItemSparse.db2's layout, not Item.db2's — so build validity
 * for the two files is declared and tracked separately here.
 */
export class ItemSparseSchema {
  /** Build range this schema's field indices are known to be correct for. */
  public static readonly VALID_BUILDS: { from: number; to: number | null } = { from: 68209, to: null };

  /** build -> layoutHash. 12.1 only: the field indices in parseSparse() are
   *  written for layout 0x1C17D17F, so the 11.2.7 layout (0xABF517CD) is
   *  deliberately absent and that data reports a mismatch rather than being
   *  parsed with the wrong offsets. */
  public static readonly LAYOUT_HASHES: Map<number, number> = new Map<number, number>([
    [69497, 0x1c17d17f],
  ]);

  /** Name used in gate errors and the validate-build-schemas report. */
  public static readonly SCHEMA_NAME = "ItemSparseSchema";

  /**
   * Inline field layout of an ItemSparse.db2 record, in record order.
   *
   * ItemSparse is sparse: records vary in length and strings are stored inline,
   * so a field's position depends on the contents of the record holding it and
   * has to be walked per record. The file does not record its own field types,
   * so they are declared here, matching the WoWDBDefs definition for layout
   * 0x1C17D17F.
   *
   * The noninline ID column is omitted: the catalog carries it, not the record.
   *
   * Confirmed against the shipped 12.1 file - walking these types accounts for
   * every byte of all 175,059 records, to within the padding that aligns each
   * record to a four-byte boundary.
   */
  public static readonly FIELD_SPECS = [
    /*  0 */ { name: 'Description_lang', type: DB2FieldType.String, arraySize: 1 },
    /*  1 */ { name: 'Display3_lang', type: DB2FieldType.String, arraySize: 1 },
    /*  2 */ { name: 'Display2_lang', type: DB2FieldType.String, arraySize: 1 },
    /*  3 */ { name: 'Display1_lang', type: DB2FieldType.String, arraySize: 1 },
    /*  4 */ { name: 'Display_lang', type: DB2FieldType.String, arraySize: 1 },
    /*  5 */ { name: 'ExpansionID', type: DB2FieldType.Int32, arraySize: 1 },
    /*  6 */ { name: 'DmgVariance', type: DB2FieldType.Float, arraySize: 1 },
    /*  7 */ { name: 'LimitCategory', type: DB2FieldType.Int32, arraySize: 1 },
    /*  8 */ { name: 'DurationInInventory', type: DB2FieldType.UInt32, arraySize: 1 },
    /*  9 */ { name: 'QualityModifier', type: DB2FieldType.Float, arraySize: 1 },
    /* 10 */ { name: 'BagFamily', type: DB2FieldType.UInt32, arraySize: 1 },
    /* 11 */ { name: 'StartQuestID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 12 */ { name: 'LanguageID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 13 */ { name: 'ItemRange', type: DB2FieldType.Float, arraySize: 1 },
    /* 14 */ { name: 'StatPercentageOfSocket', type: DB2FieldType.Float, arraySize: 10 },
    /* 15 */ { name: 'StatPercentEditor', type: DB2FieldType.Int32, arraySize: 10 },
    /* 16 */ { name: 'StatModifier_bonusStat', type: DB2FieldType.Int32, arraySize: 10 },
    /* 17 */ { name: 'Stackable', type: DB2FieldType.Int32, arraySize: 1 },
    /* 18 */ { name: 'MaxCount', type: DB2FieldType.Int32, arraySize: 1 },
    /* 19 */ { name: 'MinReputation', type: DB2FieldType.Int32, arraySize: 1 },
    /* 20 */ { name: 'RequiredAbility', type: DB2FieldType.UInt32, arraySize: 1 },
    /* 21 */ { name: 'AllowableRaces', type: DB2FieldType.Int32, arraySize: 2 },
    /* 22 */ { name: 'SellPrice', type: DB2FieldType.UInt32, arraySize: 1 },
    /* 23 */ { name: 'BuyPrice', type: DB2FieldType.UInt32, arraySize: 1 },
    /* 24 */ { name: 'VendorStackCount', type: DB2FieldType.UInt32, arraySize: 1 },
    /* 25 */ { name: 'PriceVariance', type: DB2FieldType.Float, arraySize: 1 },
    /* 26 */ { name: 'PriceRandomValue', type: DB2FieldType.Float, arraySize: 1 },
    /* 27 */ { name: 'Flags', type: DB2FieldType.Int32, arraySize: 5 },
    /* 28 */ { name: 'OppositeFactionItemID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 29 */ { name: 'ModifiedCraftingReagentItemID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 30 */ { name: 'ContentTuningID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 31 */ { name: 'PlayerLevelToItemLevelCurveID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 32 */ { name: 'ItemLevelOffsetCurveID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 33 */ { name: 'ItemLevelOffsetItemLevel', type: DB2FieldType.Int32, arraySize: 1 },
    /* 34 */ { name: 'ItemSquishEraID', type: DB2FieldType.Int32, arraySize: 1 },
    /* 35 */ { name: 'ItemNameDescriptionID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 36 */ { name: 'RequiredTransmogHoliday', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 37 */ { name: 'RequiredHoliday', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 38 */ { name: 'Gem_properties', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 39 */ { name: 'Socket_match_enchantment_ID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 40 */ { name: 'TotemCategoryID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 41 */ { name: 'InstanceBound', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 42 */ { name: 'ZoneBound', type: DB2FieldType.UInt16, arraySize: 2 },
    /* 43 */ { name: 'ItemSet', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 44 */ { name: 'LockID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 45 */ { name: 'PageID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 46 */ { name: 'ItemDelay', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 47 */ { name: 'MinFactionID', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 48 */ { name: 'RequiredSkillRank', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 49 */ { name: 'RequiredSkill', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 50 */ { name: 'ItemLevel', type: DB2FieldType.UInt16, arraySize: 1 },
    /* 51 */ { name: 'AllowableClass', type: DB2FieldType.Int16, arraySize: 1 },
    /* 52 */ { name: 'ArtifactID', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 53 */ { name: 'SpellWeight', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 54 */ { name: 'SpellWeightCategory', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 55 */ { name: 'SocketType', type: DB2FieldType.UInt8, arraySize: 3 },
    /* 56 */ { name: 'SheatheType', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 57 */ { name: 'Material', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 58 */ { name: 'PageMaterialID', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 59 */ { name: 'Bonding', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 60 */ { name: 'DamageType', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 61 */ { name: 'ContainerSlots', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 62 */ { name: 'RequiredPVPMedal', type: DB2FieldType.UInt8, arraySize: 1 },
    /* 63 */ { name: 'RequiredPVPRank', type: DB2FieldType.Int8, arraySize: 1 },
    /* 64 */ { name: 'RequiredLevel', type: DB2FieldType.Int8, arraySize: 1 },
    /* 65 */ { name: 'InventoryType', type: DB2FieldType.Int8, arraySize: 1 },
    /* 66 */ { name: 'OverallQualityID', type: DB2FieldType.Int8, arraySize: 1 },
  ] as const;

  /** Walker built from {@link FIELD_SPECS}, used by the loader to place fields. */
  public static readonly FIELD_LAYOUT = new DB2SparseFieldLayout([...ItemSparseSchema.FIELD_SPECS]);
}

// ItemSparse cannot be read without its layout, so register it for the file as
// soon as this module loads. Any DB2FileLoader opened on ItemSparse.db2 then
// resolves it by name, with no wiring needed at the call site.
registerSparseFieldLayout('ItemSparse.db2', ItemSparseSchema.FIELD_LAYOUT);
