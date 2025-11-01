/**
 * Item data query tool
 * Week 7: Enhanced with Item.db2 + ItemSparse.db2 integration via DB2CachedFileLoader
 */

import { queryWorld } from "../database/connection.js";
import { DB2CachedLoaderFactory } from "../parsers/db2/DB2CachedFileLoader.js";
import { ItemSchema } from "../parsers/schemas/ItemSchema.js";
import * as path from "path";
import * as fs from "fs";

export interface ItemInfo {
  itemId: number;
  name: string;
  quality: string;
  itemLevel: number;
  requiredLevel: number;
  itemClass: string;
  itemSubClass: string;
  inventoryType: string;
  stats: ItemStat[];
  bonuses: string[];
  // Week 7: Enhanced with DB2 data
  db2Data?: {
    item?: {
      classID?: number;
      subclassID?: number;
      inventoryType?: number;
      sheatheType?: number;
      material?: number;
    };
    itemSparse?: {
      display?: string;
      description?: string;
      quality?: number;
      flags?: number[];
      bonusListIDs?: number[];
      statTypes?: number[];
      statValues?: number[];
      socketTypes?: number[];
    };
  };
  dataSource: "database" | "db2" | "merged";
  cacheStats?: {
    itemDB2CacheHit: boolean;
    itemSparseDB2CacheHit: boolean;
    loadTime?: string;
  };
  error?: string;
}

export interface ItemStat {
  type: string;
  value: number;
}

// DB2 file paths
const DB2_PATH = process.env.DB2_PATH || "./data/db2";
const ITEM_DB2_FILE = "Item.db2";
const ITEM_SPARSE_DB2_FILE = "ItemSparse.db2";

/**
 * Load item data from Item.db2 + ItemSparse.db2 via cached loaders
 * ItemSchema requires both files for complete item data
 * @param itemId Item ID to query
 * @returns Parsed ItemEntry or null if not found
 */
async function loadItemFromDB2(itemId: number): Promise<{
  data: any | null;
  itemCacheHit: boolean;
  itemSparseCacheHit: boolean;
  loadTime: number;
}> {
  const startTime = Date.now();

  try {
    const itemPath = path.join(DB2_PATH, ITEM_DB2_FILE);
    const itemSparsePath = path.join(DB2_PATH, ITEM_SPARSE_DB2_FILE);

    // Check if both files exist
    if (!fs.existsSync(itemPath) || !fs.existsSync(itemSparsePath)) {
      return {
        data: null,
        itemCacheHit: false,
        itemSparseCacheHit: false,
        loadTime: Date.now() - startTime,
      };
    }

    // Get cached loaders (singleton per file)
    const itemLoader = DB2CachedLoaderFactory.getLoader(ITEM_DB2_FILE);
    const itemSparseLoader = DB2CachedLoaderFactory.getLoader(ITEM_SPARSE_DB2_FILE);

    // Load files if not already loaded
    try {
      if (itemLoader.getRecordCount() === 0) {
        itemLoader.loadFromFile(itemPath);
      }
    } catch (loadError) {
      itemLoader.loadFromFile(itemPath);
    }

    try {
      if (itemSparseLoader.getRecordCount() === 0) {
        itemSparseLoader.loadFromFile(itemSparsePath);
      }
    } catch (loadError) {
      itemSparseLoader.loadFromFile(itemSparsePath);
    }

    // Get cache stats before access
    const itemStatsBefore = itemLoader.getCacheStats();
    const itemSparseStatsBefore = itemSparseLoader.getCacheStats();
    const itemHitsBefore = itemStatsBefore.totalHits;
    const itemSparseHitsBefore = itemSparseStatsBefore.totalHits;

    // Load records (automatically cached)
    const itemRecord = itemLoader.getCachedRecord(itemId);
    const itemSparseRecord = itemSparseLoader.getCachedRecord(itemId);

    // Check if these were cache hits
    const itemStatsAfter = itemLoader.getCacheStats();
    const itemSparseStatsAfter = itemSparseLoader.getCacheStats();
    const itemCacheHit = itemStatsAfter.totalHits > itemHitsBefore;
    const itemSparseCacheHit = itemSparseStatsAfter.totalHits > itemSparseHitsBefore;

    // Parse with ItemSchema (dual-file)
    const item = itemRecord ? ItemSchema.parseBasic(itemRecord) : null;
    const itemSparse = itemSparseRecord ? ItemSchema.parseSparse(itemSparseRecord) : null;

    // Combine parsed data
    const itemEntry = item && itemSparse ? { item, itemSparse } : null;

    return {
      data: itemEntry,
      itemCacheHit,
      itemSparseCacheHit,
      loadTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Error loading item from DB2:", error);
    return {
      data: null,
      itemCacheHit: false,
      itemSparseCacheHit: false,
      loadTime: Date.now() - startTime,
    };
  }
}

export async function getItemInfo(itemId: number): Promise<ItemInfo> {
  try {
    // Step 1: Load from DB2 (with caching)
    const db2Result = await loadItemFromDB2(itemId);
    const db2Item = db2Result.data;

    // Step 2: Query item_template for database data
    const query = `
      SELECT
        entry as itemId,
        name,
        Quality as quality,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        class as itemClass,
        subclass as itemSubClass,
        InventoryType as inventoryType
      FROM item_template
      WHERE entry = ?
      LIMIT 1
    `;

    const items = await queryWorld(query, [itemId]);
    const dbItem = items && items.length > 0 ? items[0] : null;

    // Step 3: Determine data source
    let dataSource: "database" | "db2" | "merged" = "database";
    if (db2Item && dbItem) {
      dataSource = "merged";
    } else if (db2Item && !dbItem) {
      dataSource = "db2";
    } else if (!db2Item && !dbItem) {
      // Neither source has data
      return {
        itemId,
        name: "Not Found",
        quality: "POOR",
        itemLevel: 0,
        requiredLevel: 0,
        itemClass: "UNKNOWN",
        itemSubClass: "UNKNOWN",
        inventoryType: "NON_EQUIP",
        stats: [],
        bonuses: [],
        dataSource: "database",
        cacheStats: {
          itemDB2CacheHit: db2Result.itemCacheHit,
          itemSparseDB2CacheHit: db2Result.itemSparseCacheHit,
          loadTime: `${db2Result.loadTime}ms`,
        },
        error: `Item ${itemId} not found in database or DB2`,
      };
    }

    // Step 4: Merge data (prefer database for gameplay values, DB2 for extended properties)
    const item = dbItem || {};

    // Extract stats from DB2 ItemSparse if available
    const stats: ItemStat[] = [];
    if (db2Item && db2Item.itemSparse) {
      const sparse = db2Item.itemSparse;
      if (sparse.stats && Array.isArray(sparse.stats)) {
        for (const stat of sparse.stats) {
          if (stat.type && stat.value) {
            stats.push({
              type: getStatTypeName(stat.type),
              value: stat.value,
            });
          }
        }
      }
    }

    // Extract bonuses from DB2
    const bonuses: string[] = [];
    if (db2Item && db2Item.itemSparse && db2Item.itemSparse.bonusListIds) {
      bonuses.push(...db2Item.itemSparse.bonusListIds.map((id: number) => `Bonus_${id}`));
    }

    return {
      itemId: item.itemId || itemId,
      name: item.name || db2Item?.itemSparse?.display || db2Item?.itemSparse?.name || "Unknown",
      quality: getQualityName(item.quality || db2Item?.itemSparse?.overallQualityId || 0),
      itemLevel: item.itemLevel || db2Item?.itemSparse?.itemLevel || 0,
      requiredLevel: item.requiredLevel || db2Item?.itemSparse?.requiredLevel || 0,
      itemClass: getItemClassName(item.itemClass || db2Item?.item?.classId || 0),
      itemSubClass: (item.itemSubClass || db2Item?.item?.subclassId || 0).toString(),
      inventoryType: getInventoryTypeName(
        item.inventoryType || db2Item?.itemSparse?.inventoryType || 0
      ),
      stats,
      bonuses,
      // Week 7: Include DB2 data
      db2Data: db2Item
        ? {
            item: db2Item.item,
            itemSparse: db2Item.itemSparse,
          }
        : undefined,
      dataSource,
      cacheStats: {
        itemDB2CacheHit: db2Result.itemCacheHit,
        itemSparseDB2CacheHit: db2Result.itemSparseCacheHit,
        loadTime: `${db2Result.loadTime}ms`,
      },
    };
  } catch (error) {
    return {
      itemId,
      name: "Error",
      quality: "POOR",
      itemLevel: 0,
      requiredLevel: 0,
      itemClass: "UNKNOWN",
      itemSubClass: "UNKNOWN",
      inventoryType: "NON_EQUIP",
      stats: [],
      bonuses: [],
      dataSource: "database",
      cacheStats: {
        itemDB2CacheHit: false,
        itemSparseDB2CacheHit: false,
        loadTime: "0ms",
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get stat type name from stat type ID
 * Based on WoW 11.2 item stat types
 */
function getStatTypeName(statType: number): string {
  const statTypes: { [key: number]: string } = {
    0: "MANA",
    1: "HEALTH",
    3: "AGILITY",
    4: "STRENGTH",
    5: "INTELLECT",
    6: "SPIRIT",
    7: "STAMINA",
    12: "DEFENSE_SKILL_RATING",
    13: "DODGE_RATING",
    14: "PARRY_RATING",
    15: "BLOCK_RATING",
    16: "HIT_MELEE_RATING",
    17: "HIT_RANGED_RATING",
    18: "HIT_SPELL_RATING",
    19: "CRIT_MELEE_RATING",
    20: "CRIT_RANGED_RATING",
    21: "CRIT_SPELL_RATING",
    22: "CORRUPTION",
    23: "CORRUPTION_RESISTANCE",
    28: "HASTE_MELEE_RATING",
    29: "HASTE_RANGED_RATING",
    30: "HASTE_SPELL_RATING",
    31: "HIT_RATING",
    32: "CRIT_RATING",
    33: "HIT_TAKEN_RATING",
    34: "CRIT_TAKEN_RATING",
    35: "RESILIENCE_RATING",
    36: "HASTE_RATING",
    37: "EXPERTISE_RATING",
    38: "ATTACK_POWER",
    39: "RANGED_ATTACK_POWER",
    40: "VERSATILITY",
    41: "SPELL_HEALING_DONE",
    42: "SPELL_DAMAGE_DONE",
    43: "MANA_REGENERATION",
    44: "ARMOR_PENETRATION_RATING",
    45: "SPELL_POWER",
    46: "HEALTH_REGEN",
    47: "SPELL_PENETRATION",
    48: "BLOCK_VALUE",
    49: "MASTERY_RATING",
    50: "BONUS_ARMOR",
    51: "FIRE_RESISTANCE",
    52: "FROST_RESISTANCE",
    53: "HOLY_RESISTANCE",
    54: "SHADOW_RESISTANCE",
    55: "NATURE_RESISTANCE",
    56: "ARCANE_RESISTANCE",
    57: "PVP_POWER",
    59: "SPEED",
    60: "LEECH",
    61: "AVOIDANCE",
    62: "INDESTRUCTIBLE",
  };
  return statTypes[statType] || `STAT_${statType}`;
}

function getQualityName(quality: number): string {
  const qualities = ["POOR", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "ARTIFACT"];
  return qualities[quality] || "UNKNOWN";
}

function getItemClassName(itemClass: number): string {
  const classes = [
    "CONSUMABLE",
    "CONTAINER",
    "WEAPON",
    "GEM",
    "ARMOR",
    "REAGENT",
    "PROJECTILE",
    "TRADE_GOODS",
    "GENERIC",
    "RECIPE",
    "MONEY",
    "QUIVER",
    "QUEST",
    "KEY",
    "PERMANENT",
    "MISC",
  ];
  return classes[itemClass] || "UNKNOWN";
}

function getInventoryTypeName(type: number): string {
  const types = [
    "NON_EQUIP",
    "HEAD",
    "NECK",
    "SHOULDERS",
    "BODY",
    "CHEST",
    "WAIST",
    "LEGS",
    "FEET",
    "WRISTS",
    "HANDS",
    "FINGER",
    "TRINKET",
    "WEAPON",
    "SHIELD",
    "RANGED",
    "CLOAK",
    "TWO_HAND_WEAPON",
    "BAG",
    "TABARD",
    "ROBE",
    "MAIN_HAND",
    "OFF_HAND",
    "HOLDABLE",
    "AMMO",
    "THROWN",
    "RANGED_RIGHT",
    "QUIVER",
    "RELIC",
  ];
  return types[type] || "UNKNOWN";
}
