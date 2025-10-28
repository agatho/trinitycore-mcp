/**
 * Item data query tool
 */

import { queryWorld } from "../database/connection.js";

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
  error?: string;
}

export interface ItemStat {
  type: string;
  value: number;
}

export async function getItemInfo(itemId: number): Promise<ItemInfo> {
  try {
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

    if (!items || items.length === 0) {
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
        error: `Item ${itemId} not found`,
      };
    }

    const item = items[0];

    return {
      itemId: item.itemId,
      name: item.name,
      quality: getQualityName(item.quality),
      itemLevel: item.itemLevel,
      requiredLevel: item.requiredLevel,
      itemClass: getItemClassName(item.itemClass),
      itemSubClass: item.itemSubClass.toString(),
      inventoryType: getInventoryTypeName(item.inventoryType),
      stats: [],
      bonuses: [],
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
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
