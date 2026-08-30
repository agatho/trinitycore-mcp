/**
 * Shared Item Data Query Abstraction for TrinityCore 12.0.1
 *
 * In TrinityCore 12.0.1, item data was moved from the world database (item_template)
 * to the hotfixes database (item + item_sparse tables). This module provides a unified
 * interface for querying item data from the correct sources:
 *
 * 1. Hotfixes DB: `item` table (core fields) + `item_sparse` table (extended fields)
 * 2. DB2 cache files: item_cache.json / item_sparse_cache.json
 * 3. DB2 file parsing: Item.db2 + ItemSparse.db2
 *
 * All tools that previously queried `item_template` should use this module instead.
 *
 * @module utils/item-query
 */

import { queryHotfixes } from "../database/connection";
import { safeLimit } from "./sql-limit";
import { logger } from "./logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Basic item information from hotfixes.item + hotfixes.item_sparse
 * Maps to the most commonly needed fields across all MCP tools.
 */
export interface HotfixesItemData {
  /** Item ID (entry) */
  ID: number;
  /** Item display name (from item_sparse.Display) */
  name: string;
  /** Item class ID (Armor=4, Weapon=2, Consumable=0, etc.) from item.ClassID */
  classID: number;
  /** Item subclass ID from item.SubclassID */
  subclassID: number;
  /** Inventory type (Head=1, Neck=2, etc.) from item_sparse.InventoryType */
  inventoryType: number;
  /** Item quality (0=Poor, 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary) */
  quality: number;
  /** Item level from item_sparse.ItemLevel */
  itemLevel: number;
  /** Required player level from item_sparse.RequiredLevel */
  requiredLevel: number;
  /** Sell price in copper from item_sparse.SellPrice */
  sellPrice: number;
  /** Buy price in copper from item_sparse.BuyPrice */
  buyPrice: number;
  /** Description text from item_sparse.Description */
  description: string;
  /** Material type from item.Material */
  material: number;
  /** Sheathe type from item.SheatheType */
  sheatheType: number;
  /** Bonding type (0=None, 1=BoP, 2=BoE, 3=BoU, 4=Quest) */
  bonding: number;
  /** Max stack count from item_sparse.Stackable */
  stackable: number;
  /** Max count (unique limit) from item_sparse.MaxCount */
  maxCount: number;
  /** Container slots from item_sparse.ContainerSlots */
  containerSlots: number;
  /** Required skill ID from item_sparse.RequiredSkill */
  requiredSkill: number;
  /** Required skill rank from item_sparse.RequiredSkillRank */
  requiredSkillRank: number;
  /** Allowable class mask from item_sparse.AllowableClass */
  allowableClass: number;
  /** Allowable race mask from item_sparse.AllowableRace */
  allowableRace: number;
  /** Flags from item_sparse (Flags1-5) */
  flags: number[];
  /** Stat types (StatModifierBonusStat1-10) */
  statTypes: number[];
  /** Stat values (StatPercentEditor1-10) */
  statValues: number[];
  /** Socket types (SocketType1-3) */
  socketTypes: number[];
  /** Item set ID from item_sparse.ItemSet */
  itemSet: number;
  /** Attack delay in ms from item_sparse.ItemDelay */
  itemDelay: number;
  /** Damage type from item_sparse.DamageDamageType */
  damageType: number;
  /** Content tuning ID from item.ContentTuningID */
  contentTuningID: number;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query a single item by ID from the hotfixes database.
 * Joins item + item_sparse to provide complete item data.
 *
 * @param itemId - The item ID to query
 * @returns HotfixesItemData if found, null if not found
 */
export async function queryItemById(itemId: number): Promise<HotfixesItemData | null> {
  try {
    const query = `
      SELECT
        i.ID,
        COALESCE(isl.Display_lang, isp.Display, '') as name,
        i.ClassID as classID,
        i.SubclassID as subclassID,
        isp.InventoryType as inventoryType,
        isp.OverallQualityID as quality,
        isp.ItemLevel as itemLevel,
        isp.RequiredLevel as requiredLevel,
        isp.SellPrice as sellPrice,
        isp.BuyPrice as buyPrice,
        COALESCE(isl.Description_lang, isp.Description, '') as description,
        i.Material as material,
        i.SheatheType as sheatheType,
        isp.Bonding as bonding,
        isp.Stackable as stackable,
        isp.MaxCount as maxCount,
        isp.ContainerSlots as containerSlots,
        isp.RequiredSkill as requiredSkill,
        isp.RequiredSkillRank as requiredSkillRank,
        isp.AllowableClass as allowableClass,
        isp.AllowableRace as allowableRace,
        isp.Flags1 as flags1,
        isp.Flags2 as flags2,
        isp.Flags3 as flags3,
        isp.Flags4 as flags4,
        isp.Flags5 as flags5,
        isp.StatModifierBonusStat1 as stat1Type, isp.StatPercentEditor1 as stat1Value,
        isp.StatModifierBonusStat2 as stat2Type, isp.StatPercentEditor2 as stat2Value,
        isp.StatModifierBonusStat3 as stat3Type, isp.StatPercentEditor3 as stat3Value,
        isp.StatModifierBonusStat4 as stat4Type, isp.StatPercentEditor4 as stat4Value,
        isp.StatModifierBonusStat5 as stat5Type, isp.StatPercentEditor5 as stat5Value,
        isp.StatModifierBonusStat6 as stat6Type, isp.StatPercentEditor6 as stat6Value,
        isp.StatModifierBonusStat7 as stat7Type, isp.StatPercentEditor7 as stat7Value,
        isp.StatModifierBonusStat8 as stat8Type, isp.StatPercentEditor8 as stat8Value,
        isp.StatModifierBonusStat9 as stat9Type, isp.StatPercentEditor9 as stat9Value,
        isp.StatModifierBonusStat10 as stat10Type, isp.StatPercentEditor10 as stat10Value,
        isp.SocketType1 as socket1, isp.SocketType2 as socket2, isp.SocketType3 as socket3,
        isp.ItemSet as itemSet,
        isp.ItemDelay as itemDelay,
        isp.DamageDamageType as damageType,
        i.ContentTuningID as contentTuningID
      FROM item i
      INNER JOIN item_sparse isp ON i.ID = isp.ID
      LEFT JOIN item_sparse_locale isl ON i.ID = isl.ID AND isl.locale = 'enUS'
      WHERE i.ID = ?
      LIMIT 1
    `;

    const rows = await queryHotfixes(query, [itemId]);
    if (!rows || rows.length === 0) {
      return null;
    }

    return mapRowToItemData(rows[0]);
  } catch (error) {
    logger.warn(`[item-query] Failed to query item ${itemId} from hotfixes DB:`,
      error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Query item name by ID from the hotfixes database.
 * Lightweight query returning just the name - use when only name is needed.
 *
 * @param itemId - The item ID to query
 * @returns Item name string, or null if not found
 */
export async function queryItemName(itemId: number): Promise<string | null> {
  try {
    const query = `
      SELECT COALESCE(isl.Display_lang, isp.Display, '') as name
      FROM item_sparse isp
      LEFT JOIN item_sparse_locale isl ON isp.ID = isl.ID AND isl.locale = 'enUS'
      WHERE isp.ID = ?
      LIMIT 1
    `;
    const rows = await queryHotfixes(query, [itemId]);
    if (!rows || rows.length === 0) {
      return null;
    }
    return rows[0].name || null;
  } catch (error) {
    logger.warn(`[item-query] Failed to query item name for ${itemId}:`,
      error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Query item sell price by ID from the hotfixes database.
 *
 * @param itemId - The item ID to query
 * @returns Sell price in copper, or 0 if not found
 */
export async function queryItemSellPrice(itemId: number): Promise<number> {
  try {
    const query = `
      SELECT SellPrice as sellPrice
      FROM item_sparse
      WHERE ID = ?
      LIMIT 1
    `;
    const rows = await queryHotfixes(query, [itemId]);
    if (!rows || rows.length === 0) {
      return 0;
    }
    return rows[0].sellPrice || 0;
  } catch (error) {
    logger.warn(`[item-query] Failed to query sell price for item ${itemId}:`,
      error instanceof Error ? error.message : String(error));
    return 0;
  }
}

/**
 * Search items by name pattern from the hotfixes database.
 *
 * @param namePattern - SQL LIKE pattern (e.g., "%sword%")
 * @param limit - Maximum results (default 50)
 * @returns Array of matching HotfixesItemData
 */
export async function searchItemsByName(namePattern: string, limit: number = 50): Promise<HotfixesItemData[]> {
  try {
    const query = `
      SELECT
        i.ID,
        COALESCE(isl.Display_lang, isp.Display, '') as name,
        i.ClassID as classID,
        i.SubclassID as subclassID,
        isp.InventoryType as inventoryType,
        isp.OverallQualityID as quality,
        isp.ItemLevel as itemLevel,
        isp.RequiredLevel as requiredLevel,
        isp.SellPrice as sellPrice,
        isp.BuyPrice as buyPrice,
        COALESCE(isl.Description_lang, isp.Description, '') as description,
        i.Material as material,
        i.SheatheType as sheatheType,
        isp.Bonding as bonding,
        isp.Stackable as stackable,
        isp.MaxCount as maxCount,
        isp.ContainerSlots as containerSlots,
        isp.RequiredSkill as requiredSkill,
        isp.RequiredSkillRank as requiredSkillRank,
        isp.AllowableClass as allowableClass,
        isp.AllowableRace as allowableRace,
        isp.Flags1 as flags1, isp.Flags2 as flags2, isp.Flags3 as flags3,
        isp.Flags4 as flags4, isp.Flags5 as flags5,
        isp.StatModifierBonusStat1 as stat1Type, isp.StatPercentEditor1 as stat1Value,
        isp.StatModifierBonusStat2 as stat2Type, isp.StatPercentEditor2 as stat2Value,
        isp.StatModifierBonusStat3 as stat3Type, isp.StatPercentEditor3 as stat3Value,
        isp.StatModifierBonusStat4 as stat4Type, isp.StatPercentEditor4 as stat4Value,
        isp.StatModifierBonusStat5 as stat5Type, isp.StatPercentEditor5 as stat5Value,
        isp.StatModifierBonusStat6 as stat6Type, isp.StatPercentEditor6 as stat6Value,
        isp.StatModifierBonusStat7 as stat7Type, isp.StatPercentEditor7 as stat7Value,
        isp.StatModifierBonusStat8 as stat8Type, isp.StatPercentEditor8 as stat8Value,
        isp.StatModifierBonusStat9 as stat9Type, isp.StatPercentEditor9 as stat9Value,
        isp.StatModifierBonusStat10 as stat10Type, isp.StatPercentEditor10 as stat10Value,
        isp.SocketType1 as socket1, isp.SocketType2 as socket2, isp.SocketType3 as socket3,
        isp.ItemSet as itemSet,
        isp.ItemDelay as itemDelay,
        isp.DamageDamageType as damageType,
        i.ContentTuningID as contentTuningID
      FROM item i
      INNER JOIN item_sparse isp ON i.ID = isp.ID
      LEFT JOIN item_sparse_locale isl ON i.ID = isl.ID AND isl.locale = 'enUS'
      WHERE COALESCE(isl.Display_lang, isp.Display, '') LIKE ?
      ORDER BY i.ID ASC
      LIMIT ${safeLimit(limit)}
    `;
    const rows = await queryHotfixes(query, [namePattern]);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map(mapRowToItemData);
  } catch (error) {
    logger.warn(`[item-query] Failed to search items by name "${namePattern}":`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Query items by class and optional subclass from the hotfixes database.
 * Replaces old queries like: SELECT * FROM item_template WHERE class = ? AND subclass = ?
 *
 * @param classID - Item class ID (0=Consumable, 2=Weapon, 4=Armor, 15=Miscellaneous, etc.)
 * @param subclassID - Optional subclass ID filter
 * @param limit - Maximum results (default 100)
 * @returns Array of matching HotfixesItemData
 */
export async function queryItemsByClass(
  classID: number,
  subclassID?: number,
  limit: number = 100
): Promise<HotfixesItemData[]> {
  try {
    let query = `
      SELECT
        i.ID,
        COALESCE(isl.Display_lang, isp.Display, '') as name,
        i.ClassID as classID,
        i.SubclassID as subclassID,
        isp.InventoryType as inventoryType,
        isp.OverallQualityID as quality,
        isp.ItemLevel as itemLevel,
        isp.RequiredLevel as requiredLevel,
        isp.SellPrice as sellPrice,
        isp.BuyPrice as buyPrice,
        COALESCE(isl.Description_lang, isp.Description, '') as description,
        i.Material as material,
        i.SheatheType as sheatheType,
        isp.Bonding as bonding,
        isp.Stackable as stackable,
        isp.MaxCount as maxCount,
        isp.ContainerSlots as containerSlots,
        isp.RequiredSkill as requiredSkill,
        isp.RequiredSkillRank as requiredSkillRank,
        isp.AllowableClass as allowableClass,
        isp.AllowableRace as allowableRace,
        isp.Flags1 as flags1, isp.Flags2 as flags2, isp.Flags3 as flags3,
        isp.Flags4 as flags4, isp.Flags5 as flags5,
        isp.StatModifierBonusStat1 as stat1Type, isp.StatPercentEditor1 as stat1Value,
        isp.StatModifierBonusStat2 as stat2Type, isp.StatPercentEditor2 as stat2Value,
        isp.StatModifierBonusStat3 as stat3Type, isp.StatPercentEditor3 as stat3Value,
        isp.StatModifierBonusStat4 as stat4Type, isp.StatPercentEditor4 as stat4Value,
        isp.StatModifierBonusStat5 as stat5Type, isp.StatPercentEditor5 as stat5Value,
        isp.StatModifierBonusStat6 as stat6Type, isp.StatPercentEditor6 as stat6Value,
        isp.StatModifierBonusStat7 as stat7Type, isp.StatPercentEditor7 as stat7Value,
        isp.StatModifierBonusStat8 as stat8Type, isp.StatPercentEditor8 as stat8Value,
        isp.StatModifierBonusStat9 as stat9Type, isp.StatPercentEditor9 as stat9Value,
        isp.StatModifierBonusStat10 as stat10Type, isp.StatPercentEditor10 as stat10Value,
        isp.SocketType1 as socket1, isp.SocketType2 as socket2, isp.SocketType3 as socket3,
        isp.ItemSet as itemSet,
        isp.ItemDelay as itemDelay,
        isp.DamageDamageType as damageType,
        i.ContentTuningID as contentTuningID
      FROM item i
      INNER JOIN item_sparse isp ON i.ID = isp.ID
      LEFT JOIN item_sparse_locale isl ON i.ID = isl.ID AND isl.locale = 'enUS'
      WHERE i.ClassID = ?
    `;
    const params: any[] = [classID];

    if (subclassID !== undefined) {
      query += ` AND i.SubclassID = ?`;
      params.push(subclassID);
    }

    query += ` ORDER BY i.ID ASC LIMIT ${safeLimit(limit)}`;

    const rows = await queryHotfixes(query, params);
    if (!rows || !Array.isArray(rows)) {
      return [];
    }
    return rows.map(mapRowToItemData);
  } catch (error) {
    logger.warn(`[item-query] Failed to query items by class ${classID}/${subclassID}:`,
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Count items matching a filter from the hotfixes database.
 * Replaces old queries like: SELECT COUNT(*) FROM item_template WHERE ...
 *
 * @param classID - Optional class ID filter
 * @param subclassID - Optional subclass ID filter
 * @param flagsMask - Optional flags mask (checked against Flags1)
 * @returns Count of matching items
 */
export async function countItems(
  classID?: number,
  subclassID?: number,
  flagsMask?: number
): Promise<number> {
  try {
    let query = `SELECT COUNT(*) as total FROM item i INNER JOIN item_sparse isp ON i.ID = isp.ID WHERE 1=1`;
    const params: any[] = [];

    if (classID !== undefined) {
      query += ` AND i.ClassID = ?`;
      params.push(classID);
    }
    if (subclassID !== undefined) {
      query += ` AND i.SubclassID = ?`;
      params.push(subclassID);
    }
    if (flagsMask !== undefined) {
      query += ` AND (isp.Flags1 & ?) != 0`;
      params.push(flagsMask);
    }

    const rows = await queryHotfixes(query, params);
    return rows?.[0]?.total || 0;
  } catch (error) {
    logger.warn(`[item-query] Failed to count items:`,
      error instanceof Error ? error.message : String(error));
    return 0;
  }
}

/**
 * Query basic item data (ID, name, quality, itemLevel) for a list of item IDs.
 * Useful for batch lookups like vendor items or quest rewards.
 *
 * @param itemIds - Array of item IDs to query
 * @returns Map of itemId -> { name, quality, itemLevel, sellPrice }
 */
export async function queryItemBasicBatch(
  itemIds: number[]
): Promise<Map<number, { name: string; quality: number; itemLevel: number; sellPrice: number }>> {
  const result = new Map<number, { name: string; quality: number; itemLevel: number; sellPrice: number }>();
  if (!itemIds || itemIds.length === 0) {
    return result;
  }

  try {
    const placeholders = itemIds.map(() => '?').join(', ');
    const query = `
      SELECT
        isp.ID,
        COALESCE(isl.Display_lang, isp.Display, '') as name,
        isp.OverallQualityID as quality,
        isp.ItemLevel as itemLevel,
        isp.SellPrice as sellPrice
      FROM item_sparse isp
      LEFT JOIN item_sparse_locale isl ON isp.ID = isl.ID AND isl.locale = 'enUS'
      WHERE isp.ID IN (${placeholders})
    `;
    const rows = await queryHotfixes(query, itemIds);
    if (rows && Array.isArray(rows)) {
      for (const row of rows) {
        result.set(row.ID, {
          name: row.name || '',
          quality: row.quality || 0,
          itemLevel: row.itemLevel || 0,
          sellPrice: row.sellPrice || 0,
        });
      }
    }
  } catch (error) {
    logger.warn(`[item-query] Failed to batch query items:`,
      error instanceof Error ? error.message : String(error));
  }

  return result;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Map a database row to HotfixesItemData
 */
function mapRowToItemData(row: any): HotfixesItemData {
  return {
    ID: row.ID || 0,
    name: row.name || '',
    classID: row.classID || 0,
    subclassID: row.subclassID || 0,
    inventoryType: row.inventoryType || 0,
    quality: row.quality || 0,
    itemLevel: row.itemLevel || 0,
    requiredLevel: row.requiredLevel || 0,
    sellPrice: row.sellPrice || 0,
    buyPrice: row.buyPrice || 0,
    description: row.description || '',
    material: row.material || 0,
    sheatheType: row.sheatheType || 0,
    bonding: row.bonding || 0,
    stackable: row.stackable || 0,
    maxCount: row.maxCount || 0,
    containerSlots: row.containerSlots || 0,
    requiredSkill: row.requiredSkill || 0,
    requiredSkillRank: row.requiredSkillRank || 0,
    allowableClass: row.allowableClass || 0,
    allowableRace: row.allowableRace || 0,
    flags: [
      row.flags1 || 0,
      row.flags2 || 0,
      row.flags3 || 0,
      row.flags4 || 0,
      row.flags5 || 0,
    ],
    statTypes: [
      row.stat1Type || 0, row.stat2Type || 0, row.stat3Type || 0, row.stat4Type || 0, row.stat5Type || 0,
      row.stat6Type || 0, row.stat7Type || 0, row.stat8Type || 0, row.stat9Type || 0, row.stat10Type || 0,
    ],
    statValues: [
      row.stat1Value || 0, row.stat2Value || 0, row.stat3Value || 0, row.stat4Value || 0, row.stat5Value || 0,
      row.stat6Value || 0, row.stat7Value || 0, row.stat8Value || 0, row.stat9Value || 0, row.stat10Value || 0,
    ],
    socketTypes: [row.socket1 || 0, row.socket2 || 0, row.socket3 || 0],
    itemSet: row.itemSet || 0,
    itemDelay: row.itemDelay || 0,
    damageType: row.damageType || 0,
    contentTuningID: row.contentTuningID || 0,
  };
}
