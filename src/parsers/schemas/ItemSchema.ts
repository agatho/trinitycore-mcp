/**
 * Item.db2 and ItemSparse.db2 Schema for WoW 11.2 (The War Within)
 * Based on TrinityCore's ItemTemplate structure
 * Source: src/server/game/Entities/Item/ItemTemplate.h
 */

import { DB2Record } from '../db2/DB2Record';

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
  value: number; // Stat value
}

/**
 * Item Damage Entry
 * Represents weapon damage
 */
export interface ItemDamage {
  damageMin: number; // Minimum damage (float)
  damageMax: number; // Maximum damage (float)
  damageType: number; // Damage school (Physical, Fire, etc.)
}

/**
 * Item Socket
 * Represents a gem socket
 */
export interface ItemSocket {
  color: number; // Socket color bitmask
  content: number; // Socket bonus gem ID
}

/**
 * Item Spell
 * Represents a spell granted by the item
 */
export interface ItemSpell {
  spellId: number; // Spell ID
  trigger: ItemSpellTriggerType; // Trigger type
  charges: number; // Number of charges (-1 = unlimited)
  cooldown: number; // Cooldown in milliseconds
  category: number; // Spell category
  categoryCooldown: number; // Category cooldown in milliseconds
}

/**
 * Item Basic Entry (Item.db2)
 * Core item identification data
 */
export interface ItemEntry {
  id: number; // Item ID (uint32)
  classId: number; // Item class (ItemClass enum)
  subclassId: number; // Item subclass (varies by class)
  material: number; // Item material (uint32)
  soundOverrideSubclassId: number; // Sound override (int32)
  iconFileDataId: number; // Icon file data ID (uint32)
  itemGroupSoundsId: number; // Sound group ID (uint32)
  contentTuningId: number; // Content tuning ID (uint32)
  modifiedCraftingReagentItemId: number; // Modified crafting reagent (uint32)
  coincidesWithOppositeMinorPatch: number; // Minor patch flag (uint8)
  expansionId: number; // Expansion ID (uint8)
}

/**
 * Item Sparse Entry (ItemSparse.db2)
 * Extended item data with stats, requirements, etc.
 */
export interface ItemSparseEntry {
  id: number; // Item ID (uint32)

  // Display and description
  name: string; // Item name (localized)
  description: string; // Item description (localized)
  display: string; // Display name variant (localized)

  // Pricing
  buyPrice: bigint; // Vendor buy price in copper (uint64)
  sellPrice: number; // Vendor sell price in copper (uint32)
  priceRandomValue: number; // Price random multiplier (float)
  priceVariance: number; // Price variance (float)
  vendorStackCount: number; // Vendor stack size (uint32)

  // Quality and level
  overallQualityId: number; // Item quality/rarity (ItemQuality)
  inventoryType: number; // Equipment slot (InventoryType)
  itemLevel: number; // Item level (uint32)
  requiredLevel: number; // Required player level (int32)

  // Requirements
  requiredSkill: number; // Required profession skill ID (uint32)
  requiredSkillRank: number; // Required skill rank (uint32)
  requiredAbility: number; // Required spell/ability (uint32)
  minFactionId: number; // Required faction ID (uint32)
  minReputation: number; // Required reputation rank (uint32)

  // Class and race restrictions
  allowableClass: number; // Class mask (int32)
  allowableRace: bigint; // Race mask (int64)

  // Flags
  flags: number; // Item flags (uint32)
  flags2: number; // Item flags 2 (uint32)
  flags3: number; // Item flags 3 (uint32)
  flags4: number; // Item flags 4 (uint32)

  // Bonding and stacking
  bonding: number; // Bonding type (ItemBondingType)
  maxCount: number; // Max count in inventory (uint32)
  maxDurability: number; // Maximum durability (uint32)
  stackable: number; // Max stack size (uint32)

  // Container
  containerSlots: number; // Bag slots (uint8)
  bagFamily: number; // Bag family mask (uint32)

  // Stats (10 stats max)
  stats: ItemStat[]; // Item stat modifiers

  // Scaling
  scalingStatDistributionId: number; // Scaling distribution ID (uint32)
  damageType: number; // Damage type (uint32)
  delay: number; // Weapon speed in milliseconds (uint32)
  rangedModRange: number; // Ranged range modifier (float)

  // Sockets
  sockets: ItemSocket[]; // Gem sockets
  socketBonus: number; // Socket bonus enchant ID (uint32)

  // Gem properties
  gemProperties: number; // Gem properties ID (uint32)

  // Armor and weapon
  armor: number; // Armor value (uint32)
  holyResistance: number; // Holy resistance (uint32)
  fireResistance: number; // Fire resistance (uint32)
  natureResistance: number; // Nature resistance (uint32)
  frostResistance: number; // Frost resistance (uint32)
  shadowResistance: number; // Shadow resistance (uint32)
  arcaneResistance: number; // Arcane resistance (uint32)

  // Damage (weapon)
  damages: ItemDamage[]; // Weapon damage entries (up to 5)

  // Spells
  spells: ItemSpell[]; // Item spells (up to 5)

  // Sheath and appearance
  sheath: number; // Sheath type (uint32)
  itemNameDescriptionId: number; // Name description ID (uint32)

  // Page and language
  pageText: number; // Page text ID (uint32)
  pageTextMaterial: number; // Page material (uint32)
  languageId: number; // Language ID (uint32)

  // Quest and map
  startQuestId: number; // Quest started by item (uint32)
  lockId: number; // Lock ID (uint32)
  randomProperty: number; // Random property ID (int32)
  randomSuffix: number; // Random suffix ID (uint32)
  itemSet: number; // Item set ID (uint32)

  // Appearance and transmog
  modifiedAppearanceId: number; // Appearance ID (uint32)
  transmogPlayerConditionId: number; // Transmog condition (uint32)

  // Area and map restrictions
  areaId: number; // Required area ID (uint32)
  mapId: number; // Required map ID (uint32)

  // Misc
  totemCategoryId: number; // Totem category (uint32)
  holidayId: number; // Holiday ID (uint32)
  limitCategory: number; // Limit category (uint32)
  factionRelated: number; // Opposite faction item ID (uint32)
  itemRange: number; // Item range (uint32)
  foodType: number; // Food type (uint32)

  // Crafting
  craftingQualityId: number; // Crafting quality ID (uint32)
  requiredExpansion: number; // Required expansion (int32)
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
  /**
   * Parse Item.db2 record (basic data)
   * @param record DB2Record from Item.db2
   * @returns Parsed ItemEntry
   */
  public static parseBasic(record: DB2Record): ItemEntry {
    return {
      id: record.getUInt32(0),
      classId: record.getUInt32(1),
      subclassId: record.getUInt32(2),
      material: record.getUInt32(3),
      soundOverrideSubclassId: record.getInt32(4),
      iconFileDataId: record.getUInt32(5),
      itemGroupSoundsId: record.getUInt32(6),
      contentTuningId: record.getUInt32(7),
      modifiedCraftingReagentItemId: record.getUInt32(8),
      coincidesWithOppositeMinorPatch: record.getUInt8(9),
      expansionId: record.getUInt8(10),
    };
  }

  /**
   * Parse ItemSparse.db2 record (extended data)
   * @param record DB2Record from ItemSparse.db2
   * @returns Parsed ItemSparseEntry
   */
  public static parseSparse(record: DB2Record): ItemSparseEntry {
    // Parse stats (10 stat slots)
    const stats: ItemStat[] = [];
    for (let i = 0; i < 10; i++) {
      const type = record.getUInt32(20 + i * 2);
      const value = record.getInt32(20 + i * 2 + 1);
      if (type > 0) {
        stats.push({ type, value });
      }
    }

    // Parse sockets (up to 3)
    const sockets: ItemSocket[] = [];
    for (let i = 0; i < 3; i++) {
      const color = record.getUInt32(40 + i * 2);
      const content = record.getUInt32(40 + i * 2 + 1);
      if (color > 0) {
        sockets.push({ color, content });
      }
    }

    // Parse damages (up to 5)
    const damages: ItemDamage[] = [];
    for (let i = 0; i < 5; i++) {
      const damageMin = record.getFloat(46 + i * 3);
      const damageMax = record.getFloat(46 + i * 3 + 1);
      const damageType = record.getUInt32(46 + i * 3 + 2);
      if (damageMin > 0 || damageMax > 0) {
        damages.push({ damageMin, damageMax, damageType });
      }
    }

    // Parse spells (up to 5)
    const spells: ItemSpell[] = [];
    for (let i = 0; i < 5; i++) {
      const spellId = record.getUInt32(61 + i * 6);
      const trigger = record.getUInt32(61 + i * 6 + 1);
      const charges = record.getInt32(61 + i * 6 + 2);
      const cooldown = record.getInt32(61 + i * 6 + 3);
      const category = record.getUInt32(61 + i * 6 + 4);
      const categoryCooldown = record.getInt32(61 + i * 6 + 5);
      if (spellId > 0) {
        spells.push({
          spellId,
          trigger,
          charges,
          cooldown,
          category,
          categoryCooldown,
        });
      }
    }

    return {
      id: record.getUInt32(0),

      // Display (fields 1-3)
      name: record.getString(1),
      description: record.getString(2),
      display: record.getString(3),

      // Pricing (fields 4-7)
      buyPrice: record.getUInt64(4),
      sellPrice: record.getUInt32(5),
      priceRandomValue: record.getFloat(6),
      priceVariance: record.getFloat(7),
      vendorStackCount: record.getUInt32(8),

      // Quality and level (fields 9-12)
      overallQualityId: record.getUInt32(9),
      inventoryType: record.getUInt32(10),
      itemLevel: record.getUInt32(11),
      requiredLevel: record.getInt32(12),

      // Requirements (fields 13-17)
      requiredSkill: record.getUInt32(13),
      requiredSkillRank: record.getUInt32(14),
      requiredAbility: record.getUInt32(15),
      minFactionId: record.getUInt32(16),
      minReputation: record.getUInt32(17),

      // Class/Race (fields 18-19)
      allowableClass: record.getInt32(18),
      allowableRace: record.getUInt64(19),

      // Stats (fields 20-39)
      stats,

      // Sockets (fields 40-45)
      sockets,
      socketBonus: record.getUInt32(46),

      // Damages (fields 47-61)
      damages,

      // Spells (fields 62-91)
      spells,

      // Flags (fields 92-95)
      flags: record.getUInt32(92),
      flags2: record.getUInt32(93),
      flags3: record.getUInt32(94),
      flags4: record.getUInt32(95),

      // Bonding/Stacking (fields 96-99)
      bonding: record.getUInt32(96),
      maxCount: record.getUInt32(97),
      maxDurability: record.getUInt32(98),
      stackable: record.getUInt32(99),

      // Container (fields 100-101)
      containerSlots: record.getUInt8(100),
      bagFamily: record.getUInt32(101),

      // Scaling (fields 102-104)
      scalingStatDistributionId: record.getUInt32(102),
      damageType: record.getUInt32(103),
      delay: record.getUInt32(104),
      rangedModRange: record.getFloat(105),

      // Gem (field 106)
      gemProperties: record.getUInt32(106),

      // Resistances (fields 107-113)
      armor: record.getUInt32(107),
      holyResistance: record.getUInt32(108),
      fireResistance: record.getUInt32(109),
      natureResistance: record.getUInt32(110),
      frostResistance: record.getUInt32(111),
      shadowResistance: record.getUInt32(112),
      arcaneResistance: record.getUInt32(113),

      // Sheath (field 114)
      sheath: record.getUInt32(114),
      itemNameDescriptionId: record.getUInt32(115),

      // Page (fields 116-118)
      pageText: record.getUInt32(116),
      pageTextMaterial: record.getUInt32(117),
      languageId: record.getUInt32(118),

      // Quest/Lock (fields 119-120)
      startQuestId: record.getUInt32(119),
      lockId: record.getUInt32(120),

      // Random properties (fields 121-123)
      randomProperty: record.getInt32(121),
      randomSuffix: record.getUInt32(122),
      itemSet: record.getUInt32(123),

      // Appearance (fields 124-125)
      modifiedAppearanceId: record.getUInt32(124),
      transmogPlayerConditionId: record.getUInt32(125),

      // Area/Map (fields 126-127)
      areaId: record.getUInt32(126),
      mapId: record.getUInt32(127),

      // Misc (fields 128-135)
      totemCategoryId: record.getUInt32(128),
      holidayId: record.getUInt32(129),
      limitCategory: record.getUInt32(130),
      factionRelated: record.getUInt32(131),
      itemRange: record.getUInt32(132),
      foodType: record.getUInt32(133),
      craftingQualityId: record.getUInt32(134),
      requiredExpansion: record.getInt32(135),
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

  /**
   * Get weapon DPS
   * @param item ItemTemplate
   * @returns Damage per second (0 if not weapon)
   */
  public static getWeaponDPS(item: ItemTemplate): number {
    if (!ItemSchema.isWeapon(item) || item.extended.damages.length === 0) {
      return 0;
    }

    const damage = item.extended.damages[0];
    const avgDamage = (damage.damageMin + damage.damageMax) / 2;
    const speed = item.extended.delay / 1000; // Convert ms to seconds

    return speed > 0 ? avgDamage / speed : 0;
  }
}
