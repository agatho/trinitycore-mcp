/**
 * Unit tests for ItemSchema
 * Tests item parsing, helper methods, and type guards
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ItemSchema,
  ItemEntry,
  ItemSparseEntry,
  ItemTemplate,
  ItemQuality,
  ItemClass,
  ItemModType,
  InventoryType,
  ItemBondingType,
  ItemSpellTriggerType,
} from '../../../src/parsers/schemas/ItemSchema';
import { MockDB2Record } from './MockDB2Record';

describe('ItemSchema', () => {
  describe('parseBasic()', () => {
    it('should parse basic item entry', () => {
      // Item.db2 layout 0x996192AA (12.1). ID is $noninline$ so it comes from
      // getId(); the inline fields start at 0 with ClassID.
      const mockRecord = new MockDB2Record({
        [-1]: 25, // id (Worn Shortsword), via getId()
        0: ItemClass.WEAPON, // classId
        1: 7, // subclassId (Sword)
        2: 1, // material (Metal)
        3: 13, // inventoryType (WEAPON)
        4: 0, // sheatheType
        5: -1, // soundOverrideSubclassId
        6: 135324, // iconFileDataId
        7: 0, // itemGroupSoundsId
        8: 0, // contentTuningId
        9: 0, // modifiedCraftingReagentItemId
        11: 0, // craftingQualityId (10 is unnamed in WoWDBDefs)
        12: 0, // itemSquishEraId
      });

      const item = ItemSchema.parseBasic(mockRecord);

      expect(item.id).toBe(25);
      expect(item.classId).toBe(ItemClass.WEAPON);
      expect(item.subclassId).toBe(7);
      expect(item.material).toBe(1);
      expect(item.inventoryType).toBe(13);
      expect(item.iconFileDataId).toBe(135324);
    });

    it('should parse consumable item', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 858, // id (Lesser Healing Potion), via getId()
        0: ItemClass.CONSUMABLE, // classId
        1: 1, // subclassId (Potion)
      });

      const item = ItemSchema.parseBasic(mockRecord);

      expect(item.id).toBe(858);
      expect(item.classId).toBe(ItemClass.CONSUMABLE);
    });
  });

  describe('parseSparse()', () => {
    // Field indices are ItemSparse.db2's inline fields for the 12.1 layout
    // 0x1C17D17F. ID is a noninline column carried by the catalog, so mocks
    // supply it through getId() rather than as field 0.
    it('should parse sparse item entry with stats', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 25, // id via getId()
        4: 'Worn Shortsword', // Display_lang, the item name
        0: '', // Description_lang
        22: 3, // SellPrice
        23: 18, // BuyPrice
        66: ItemQuality.COMMON, // OverallQualityID
        65: InventoryType.WEAPON, // InventoryType
        50: 5, // ItemLevel
        64: 1, // RequiredLevel
        // Ten stat slots, each one field addressed by arrayIndex
        16: [ItemModType.STRENGTH, ItemModType.STAMINA], // StatModifier_bonusStat
        15: [2, 3], // StatPercentEditor
        14: [0, 0], // StatPercentageOfSocket
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.id).toBe(25);
      expect(item.name).toBe('Worn Shortsword');
      expect(item.overallQualityId).toBe(ItemQuality.COMMON);
      expect(item.itemLevel).toBe(5);
      expect(item.sellPrice).toBe(3);
      expect(item.buyPrice).toBe(18);
      expect(item.stats.length).toBe(2);
      expect(item.stats[0].type).toBe(ItemModType.STRENGTH);
      expect(item.stats[0].value).toBe(2);
      expect(item.stats[1].type).toBe(ItemModType.STAMINA);
      expect(item.stats[1].value).toBe(3);
    });

    it('should parse socket types', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 32837,
        4: 'Wrath of Spellfire',
        66: ItemQuality.EPIC,
        55: [1, 2, 8], // SocketType: Meta, Red, Yellow
        39: 3729, // Socket_match_enchantment_ID
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.id).toBe(32837);
      expect(item.socketTypes).toEqual([1, 2, 8]);
      expect(item.socketMatchEnchantmentId).toBe(3729);
    });

    it('should parse weapon speed and damage school', () => {
      // Damage ranges left ItemSparse; what remains is the swing speed, the
      // damage school and the variance used to derive them elsewhere.
      const mockRecord = new MockDB2Record({
        [-1]: 25,
        4: 'Worn Shortsword',
        46: 2000, // ItemDelay, milliseconds
        60: 0, // DamageType, physical
        6: 0.5, // DmgVariance
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.itemDelay).toBe(2000);
      expect(item.damageType).toBe(0);
      expect(item.dmgVariance).toBeCloseTo(0.5, 3);
    });

    it('should read the race mask from its two halves', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 25,
        4: 'Worn Shortsword',
        21: [-1, -1], // AllowableRaces, all races
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.allowableRace).toBe(BigInt(-1));
    });

    it('should read signed narrow columns', () => {
      // AllowableClass is a signed 16-bit column and is -1 for "any class";
      // reading it unsigned would report 65535.
      const mockRecord = new MockDB2Record({
        [-1]: 25,
        4: 'Worn Shortsword',
        51: -1, // AllowableClass
        64: 60, // RequiredLevel, a signed 8-bit column
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.allowableClass).toBe(-1);
      expect(item.requiredLevel).toBe(60);
    });

    it('should skip empty stat slots', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 25,
        4: 'Worn Shortsword',
        16: [ItemModType.STRENGTH, 0, ItemModType.STAMINA],
        15: [5, 99, 7],
        14: [0, 0, 0],
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.stats.length).toBe(2);
      expect(item.stats.map((s) => s.value)).toEqual([5, 7]);
    });
  });

  describe('combine()', () => {
    it('should combine basic and sparse entries', () => {
      const basic: ItemEntry = {
        id: 25,
        classId: ItemClass.WEAPON,
        subclassId: 7,
        material: 1,
        inventoryType: 13,
        sheatheType: 0,
        soundOverrideSubclassId: -1,
        iconFileDataId: 135324,
        itemGroupSoundsId: 0,
        contentTuningId: 0,
        modifiedCraftingReagentItemId: 0,
        craftingQualityId: 0,
        itemSquishEraId: 0,
        recraftReagentCountPercentage: 0,
        orderSource: 0,
      };

      const sparse: ItemSparseEntry = {
        id: 25,
        name: 'Worn Shortsword',
        description: '',
        display1: '',
        display2: '',
        display3: '',
        buyPrice: 18,
        sellPrice: 3,
        priceVariance: 1.0,
        priceRandomValue: 1.0,
        vendorStackCount: 1,
        overallQualityId: ItemQuality.COMMON,
        inventoryType: InventoryType.WEAPON,
        itemLevel: 5,
        requiredLevel: 1,
        expansionId: 0,
        itemSquishEraId: 0,
        requiredSkill: 0,
        requiredSkillRank: 0,
        requiredAbility: 0,
        minFactionId: 0,
        minReputation: 0,
        requiredPvpMedal: 0,
        requiredPvpRank: 0,
        requiredHoliday: 0,
        requiredTransmogHoliday: 0,
        allowableClass: -1,
        allowableRace: BigInt(-1),
        stats: [
          { type: ItemModType.STRENGTH, value: 2, socketPercentage: 0 },
          { type: ItemModType.STAMINA, value: 3, socketPercentage: 0 },
        ],
        flags: [0, 0, 0, 0, 0],
        contentTuningId: 0,
        playerLevelToItemLevelCurveId: 0,
        itemLevelOffsetCurveId: 0,
        itemLevelOffsetItemLevel: 0,
        damageType: 0,
        itemDelay: 2000,
        dmgVariance: 0.5,
        itemRange: 0,
        socketTypes: [0, 0, 0],
        socketMatchEnchantmentId: 0,
        gemProperties: 0,
        containerSlots: 0,
        bagFamily: 0,
        bonding: ItemBondingType.BIND_NONE,
        stackable: 1,
        maxCount: 0,
        durationInInventory: 0,
        sheatheType: 0,
        material: 1,
        artifactId: 0,
        pageId: 0,
        pageMaterialId: 0,
        languageId: 0,
        instanceBound: 0,
        zoneBound: [0, 0],
        startQuestId: 0,
        lockId: 0,
        itemSet: 0,
        totemCategoryId: 0,
        limitCategory: 0,
        itemNameDescriptionId: 0,
        qualityModifier: 0,
        oppositeFactionItemId: 0,
        modifiedCraftingReagentItemId: 0,
        spellWeight: 0,
        spellWeightCategory: 0,
      };

      const template = ItemSchema.combine(basic, sparse);

      expect(template.basic).toBe(basic);
      expect(template.extended).toBe(sparse);
      expect(template.basic.id).toBe(25);
      expect(template.extended.name).toBe('Worn Shortsword');
    });
  });

  describe('Helper Methods', () => {
    let template: ItemTemplate;

    beforeEach(() => {
      const basic: ItemEntry = {
        id: 25,
        classId: ItemClass.WEAPON,
        subclassId: 7,
        material: 1,
        inventoryType: 13,
        sheatheType: 0,
        soundOverrideSubclassId: -1,
        iconFileDataId: 135324,
        itemGroupSoundsId: 0,
        contentTuningId: 0,
        modifiedCraftingReagentItemId: 0,
        craftingQualityId: 0,
        itemSquishEraId: 0,
        recraftReagentCountPercentage: 0,
        orderSource: 0,
      };

      const sparse: ItemSparseEntry = {
        id: 25,
        name: 'Worn Shortsword',
        description: '',
        display1: '',
        display2: '',
        display3: '',
        buyPrice: 18,
        sellPrice: 3,
        priceVariance: 1.0,
        priceRandomValue: 1.0,
        vendorStackCount: 1,
        overallQualityId: ItemQuality.COMMON,
        inventoryType: InventoryType.WEAPON,
        itemLevel: 5,
        requiredLevel: 1,
        expansionId: 0,
        itemSquishEraId: 0,
        requiredSkill: 0,
        requiredSkillRank: 0,
        requiredAbility: 0,
        minFactionId: 0,
        minReputation: 0,
        requiredPvpMedal: 0,
        requiredPvpRank: 0,
        requiredHoliday: 0,
        requiredTransmogHoliday: 0,
        allowableClass: -1,
        allowableRace: BigInt(-1),
        stats: [
          { type: ItemModType.STRENGTH, value: 2, socketPercentage: 0 },
          { type: ItemModType.STAMINA, value: 3, socketPercentage: 0 },
        ],
        flags: [0, 0, 0, 0, 0],
        contentTuningId: 0,
        playerLevelToItemLevelCurveId: 0,
        itemLevelOffsetCurveId: 0,
        itemLevelOffsetItemLevel: 0,
        damageType: 0,
        itemDelay: 2000,
        dmgVariance: 0.5,
        itemRange: 0,
        socketTypes: [0, 0, 0],
        socketMatchEnchantmentId: 0,
        gemProperties: 0,
        containerSlots: 0,
        bagFamily: 0,
        bonding: ItemBondingType.BIND_NONE,
        stackable: 1,
        maxCount: 0,
        durationInInventory: 0,
        sheatheType: 0,
        material: 1,
        artifactId: 0,
        pageId: 0,
        pageMaterialId: 0,
        languageId: 0,
        instanceBound: 0,
        zoneBound: [0, 0],
        startQuestId: 0,
        lockId: 0,
        itemSet: 0,
        totemCategoryId: 0,
        limitCategory: 0,
        itemNameDescriptionId: 0,
        qualityModifier: 0,
        oppositeFactionItemId: 0,
        modifiedCraftingReagentItemId: 0,
        spellWeight: 0,
        spellWeightCategory: 0,
      };

      template = ItemSchema.combine(basic, sparse);
    });

    describe('isEquippable()', () => {
      it('should detect equippable item', () => {
        expect(ItemSchema.isEquippable(template)).toBe(true);
      });

      it('should detect non-equippable item', () => {
        template.extended.inventoryType = InventoryType.NON_EQUIP;
        expect(ItemSchema.isEquippable(template)).toBe(false);
      });
    });

    describe('isWeapon()', () => {
      it('should detect weapon', () => {
        expect(ItemSchema.isWeapon(template)).toBe(true);
      });

      it('should detect non-weapon', () => {
        template.basic.classId = ItemClass.CONSUMABLE;
        expect(ItemSchema.isWeapon(template)).toBe(false);
      });
    });

    describe('isArmor()', () => {
      it('should detect armor', () => {
        template.basic.classId = ItemClass.ARMOR;
        expect(ItemSchema.isArmor(template)).toBe(true);
      });

      it('should detect non-armor', () => {
        expect(ItemSchema.isArmor(template)).toBe(false);
      });
    });

    describe('isConsumable()', () => {
      it('should detect consumable', () => {
        template.basic.classId = ItemClass.CONSUMABLE;
        expect(ItemSchema.isConsumable(template)).toBe(true);
      });

      it('should detect non-consumable', () => {
        expect(ItemSchema.isConsumable(template)).toBe(false);
      });
    });

    describe('getQualityName()', () => {
      it('should return correct quality names', () => {
        expect(ItemSchema.getQualityName(ItemQuality.POOR)).toBe('Poor');
        expect(ItemSchema.getQualityName(ItemQuality.COMMON)).toBe('Common');
        expect(ItemSchema.getQualityName(ItemQuality.UNCOMMON)).toBe('Uncommon');
        expect(ItemSchema.getQualityName(ItemQuality.RARE)).toBe('Rare');
        expect(ItemSchema.getQualityName(ItemQuality.EPIC)).toBe('Epic');
        expect(ItemSchema.getQualityName(ItemQuality.LEGENDARY)).toBe('Legendary');
      });
    });

    describe('getQualityColor()', () => {
      it('should return correct quality colors', () => {
        expect(ItemSchema.getQualityColor(ItemQuality.POOR)).toBe('#9d9d9d');
        expect(ItemSchema.getQualityColor(ItemQuality.COMMON)).toBe('#ffffff');
        expect(ItemSchema.getQualityColor(ItemQuality.UNCOMMON)).toBe('#1eff00');
        expect(ItemSchema.getQualityColor(ItemQuality.RARE)).toBe('#0070dd');
        expect(ItemSchema.getQualityColor(ItemQuality.EPIC)).toBe('#a335ee');
        expect(ItemSchema.getQualityColor(ItemQuality.LEGENDARY)).toBe('#ff8000');
      });
    });

    describe('canSellToVendor()', () => {
      it('should detect sellable item', () => {
        expect(ItemSchema.canSellToVendor(template)).toBe(true);
      });

      it('should detect non-sellable item', () => {
        template.extended.sellPrice = 0;
        expect(ItemSchema.canSellToVendor(template)).toBe(false);
      });
    });

    describe('isSoulbound()', () => {
      it('should detect soulbound item', () => {
        template.extended.bonding = ItemBondingType.BIND_ON_ACQUIRE;
        expect(ItemSchema.isSoulbound(template)).toBe(true);
      });

      it('should detect non-soulbound item', () => {
        expect(ItemSchema.isSoulbound(template)).toBe(false);
      });
    });

    describe('getPrimaryStatValue()', () => {
      it('should return first stat value', () => {
        expect(ItemSchema.getPrimaryStatValue(template)).toBe(2);
      });

      it('should return 0 for items with no stats', () => {
        template.extended.stats = [];
        expect(ItemSchema.getPrimaryStatValue(template)).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle expensive items', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 123456,
        4: 'Expensive Mount',
        23: 2500000000, // BuyPrice, near the top of the unsigned range
        22: 250000000, // SellPrice
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.buyPrice).toBe(2500000000);
      expect(item.sellPrice).toBe(250000000);
    });

    it('should handle items with all stat slots filled', () => {
      const types = [
        ItemModType.STRENGTH,
        ItemModType.AGILITY,
        ItemModType.STAMINA,
        ItemModType.INTELLECT,
        ItemModType.SPIRIT,
        ItemModType.CRIT_MELEE_RATING,
        ItemModType.HASTE_MELEE_RATING,
        ItemModType.HIT_MELEE_RATING,
        ItemModType.DODGE_RATING,
        ItemModType.PARRY_RATING,
      ];
      const mockRecord = new MockDB2Record({
        [-1]: 12345,
        4: 'Super Item',
        16: types,
        15: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        14: new Array(10).fill(0),
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.stats.length).toBe(10);
      expect(item.stats[9].type).toBe(ItemModType.PARRY_RATING);
      expect(item.stats[9].value).toBe(100);
    });

    it('should expose all five flag words', () => {
      const mockRecord = new MockDB2Record({
        [-1]: 12345,
        4: 'Flagged Item',
        27: [1, 2, 4, 8, 16],
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.flags).toEqual([1, 2, 4, 8, 16]);
    });
  });
});
