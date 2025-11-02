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
      const mockRecord = new MockDB2Record({
        0: 25, // id (Worn Shortsword)
        1: ItemClass.WEAPON, // classId
        2: 7, // subclassId (Sword)
        3: 1, // material (Metal)
        4: -1, // soundOverrideSubclassId
        5: 135324, // iconFileDataId
        6: 0, // itemGroupSoundsId
        7: 0, // contentTuningId
        8: 0, // modifiedCraftingReagentItemId
        9: 0, // coincidesWithOppositeMinorPatch
        10: 0, // expansionId (Classic)
      });

      const item = ItemSchema.parseBasic(mockRecord);

      expect(item.id).toBe(25);
      expect(item.classId).toBe(ItemClass.WEAPON);
      expect(item.subclassId).toBe(7);
      expect(item.material).toBe(1);
    });

    it('should parse consumable item', () => {
      const mockRecord = new MockDB2Record({
        0: 858, // id (Lesser Healing Potion)
        1: ItemClass.CONSUMABLE,
        2: 1, // Potion
      });

      const item = ItemSchema.parseBasic(mockRecord);

      expect(item.id).toBe(858);
      expect(item.classId).toBe(ItemClass.CONSUMABLE);
    });
  });

  describe('parseSparse()', () => {
    it('should parse sparse item entry with stats', () => {
      const mockRecord = new MockDB2Record({
        0: 25, // id
        1: 'Worn Shortsword', // name
        2: '', // description
        3: '', // display
        4: BigInt(0), // buyPrice
        5: 18, // sellPrice
        9: ItemQuality.COMMON, // overallQualityId
        10: InventoryType.WEAPON, // inventoryType
        11: 5, // itemLevel
        12: 1, // requiredLevel
        // Stats: 10 slots × 2 fields (type, value)
        20: ItemModType.STRENGTH, // stat 0 type
        21: 2, // stat 0 value
        22: ItemModType.STAMINA, // stat 1 type
        23: 3, // stat 1 value
        24: 0, // stat 2 type (empty)
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.id).toBe(25);
      expect(item.name).toBe('Worn Shortsword');
      expect(item.overallQualityId).toBe(ItemQuality.COMMON);
      expect(item.itemLevel).toBe(5);
      expect(item.stats.length).toBe(2);
      expect(item.stats[0].type).toBe(ItemModType.STRENGTH);
      expect(item.stats[0].value).toBe(2);
      expect(item.stats[1].type).toBe(ItemModType.STAMINA);
      expect(item.stats[1].value).toBe(3);
    });

    it('should parse item with sockets', () => {
      const mockRecord = new MockDB2Record({
        0: 32837, // id (Wrath of Spellfire)
        1: 'Wrath of Spellfire',
        9: ItemQuality.EPIC,
        // Sockets: 3 slots × 2 fields (color, content)
        40: 1, // socket 0 color (Meta)
        41: 0, // socket 0 content
        42: 2, // socket 1 color (Red)
        43: 0, // socket 1 content
        44: 8, // socket 2 color (Yellow)
        45: 0, // socket 2 content
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.id).toBe(32837);
      expect(item.sockets.length).toBe(3);
      expect(item.sockets[0].color).toBe(1); // Meta
      expect(item.sockets[1].color).toBe(2); // Red
      expect(item.sockets[2].color).toBe(8); // Yellow
    });

    it('should parse weapon with damage', () => {
      const mockRecord = new MockDB2Record({
        0: 25, // id
        1: 'Worn Shortsword',
        9: ItemQuality.COMMON,
        // Damages: 5 slots × 3 fields (min, max, type)
        46: 3.0, // damage 0 min
        47: 7.0, // damage 0 max
        48: 0, // damage 0 type (Physical)
        49: 0.0, // damage 1 min (empty)
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.damages.length).toBe(1);
      expect(item.damages[0].damageMin).toBe(3.0);
      expect(item.damages[0].damageMax).toBe(7.0);
      expect(item.damages[0].damageType).toBe(0); // Physical
    });

    it('should parse item with spells', () => {
      const mockRecord = new MockDB2Record({
        0: 5512, // id (Healthstone)
        1: 'Healthstone',
        // Spells: 5 slots × 6 fields (id, trigger, charges, cooldown, category, categoryCooldown)
        61: 6262, // spell 0 id (Healthstone heal)
        62: ItemSpellTriggerType.ON_USE, // spell 0 trigger
        63: 1, // spell 0 charges
        64: 120000, // spell 0 cooldown (2 minutes)
        65: 0, // spell 0 category
        66: 0, // spell 0 categoryCooldown
        67: 0, // spell 1 id (empty)
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.spells.length).toBe(1);
      expect(item.spells[0].spellId).toBe(6262);
      expect(item.spells[0].trigger).toBe(ItemSpellTriggerType.ON_USE);
      expect(item.spells[0].charges).toBe(1);
      expect(item.spells[0].cooldown).toBe(120000);
    });

    it('should parse item with resistances', () => {
      const mockRecord = new MockDB2Record({
        0: 1234, // id
        1: 'Test Armor',
        91: 100, // armor
        92: 5, // holyResistance
        93: 10, // fireResistance
        94: 15, // natureResistance
        95: 20, // frostResistance
        96: 25, // shadowResistance
        97: 30, // arcaneResistance
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.armor).toBe(100);
      expect(item.holyResistance).toBe(5);
      expect(item.fireResistance).toBe(10);
      expect(item.natureResistance).toBe(15);
      expect(item.frostResistance).toBe(20);
      expect(item.shadowResistance).toBe(25);
      expect(item.arcaneResistance).toBe(30);
    });
  });

  describe('combine()', () => {
    it('should combine basic and sparse entries', () => {
      const basic: ItemEntry = {
        id: 25,
        classId: ItemClass.WEAPON,
        subclassId: 7,
        material: 1,
        soundOverrideSubclassId: -1,
        iconFileDataId: 135324,
        itemGroupSoundsId: 0,
        contentTuningId: 0,
        modifiedCraftingReagentItemId: 0,
        coincidesWithOppositeMinorPatch: 0,
        expansionId: 0,
      };

      const sparse: ItemSparseEntry = {
        id: 25,
        name: 'Worn Shortsword',
        description: '',
        display: '',
        buyPrice: BigInt(0),
        sellPrice: 18,
        priceRandomValue: 0,
        priceVariance: 0,
        vendorStackCount: 1,
        overallQualityId: ItemQuality.COMMON,
        inventoryType: InventoryType.WEAPON,
        itemLevel: 5,
        requiredLevel: 1,
        requiredSkill: 0,
        requiredSkillRank: 0,
        requiredAbility: 0,
        minFactionId: 0,
        minReputation: 0,
        allowableClass: -1,
        allowableRace: BigInt(-1),
        flags: 0,
        flags2: 0,
        flags3: 0,
        flags4: 0,
        bonding: ItemBondingType.NO_BOUNDS,
        maxCount: 0,
        maxDurability: 25,
        stackable: 1,
        containerSlots: 0,
        bagFamily: 0,
        stats: [],
        scalingStatDistributionId: 0,
        damageType: 0,
        delay: 2000,
        rangedModRange: 0,
        sockets: [],
        socketBonus: 0,
        gemProperties: 0,
        armor: 0,
        holyResistance: 0,
        fireResistance: 0,
        natureResistance: 0,
        frostResistance: 0,
        shadowResistance: 0,
        arcaneResistance: 0,
        damages: [],
        sheath: 0,
        randomSelect: 0,
        itemRandomSuffixGroupId: 0,
        randomProperty: 0,
        itemSet: 0,
        area: 0,
        map: 0,
        lockId: 0,
        pageId: 0,
        pageLanguage: 0,
        pageMaterial: 0,
        startQuest: 0,
        block: 0,
        spells: [],
        itemNameDescriptionId: 0,
        disenchantId: 0,
        requiredDisenchantSkill: 0,
        foodType: 0,
        minMoneyLoot: 0,
        maxMoneyLoot: 0,
        duration: 0,
        holidayId: 0,
        limitCategory: 0,
        artifactId: 0,
        requiredExpansion: 0,
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
        soundOverrideSubclassId: -1,
        iconFileDataId: 135324,
        itemGroupSoundsId: 0,
        contentTuningId: 0,
        modifiedCraftingReagentItemId: 0,
        coincidesWithOppositeMinorPatch: 0,
        expansionId: 0,
      };

      const sparse: ItemSparseEntry = {
        id: 25,
        name: 'Worn Shortsword',
        description: '',
        display: '',
        buyPrice: BigInt(0),
        sellPrice: 18,
        priceRandomValue: 0,
        priceVariance: 0,
        vendorStackCount: 1,
        overallQualityId: ItemQuality.COMMON,
        inventoryType: InventoryType.WEAPON,
        itemLevel: 5,
        requiredLevel: 1,
        requiredSkill: 0,
        requiredSkillRank: 0,
        requiredAbility: 0,
        minFactionId: 0,
        minReputation: 0,
        allowableClass: -1,
        allowableRace: BigInt(-1),
        flags: 0,
        flags2: 0,
        flags3: 0,
        flags4: 0,
        bonding: ItemBondingType.NO_BOUNDS,
        maxCount: 0,
        maxDurability: 25,
        stackable: 1,
        containerSlots: 0,
        bagFamily: 0,
        stats: [
          { type: ItemModType.STRENGTH, value: 2 },
          { type: ItemModType.STAMINA, value: 3 },
        ],
        scalingStatDistributionId: 0,
        damageType: 0,
        delay: 2000,
        rangedModRange: 0,
        sockets: [],
        socketBonus: 0,
        gemProperties: 0,
        armor: 0,
        holyResistance: 0,
        fireResistance: 0,
        natureResistance: 0,
        frostResistance: 0,
        shadowResistance: 0,
        arcaneResistance: 0,
        damages: [{ damageMin: 3.0, damageMax: 7.0, damageType: 0 }],
        sheath: 0,
        randomSelect: 0,
        itemRandomSuffixGroupId: 0,
        randomProperty: 0,
        itemSet: 0,
        area: 0,
        map: 0,
        lockId: 0,
        pageId: 0,
        pageLanguage: 0,
        pageMaterial: 0,
        startQuest: 0,
        block: 0,
        spells: [],
        itemNameDescriptionId: 0,
        disenchantId: 0,
        requiredDisenchantSkill: 0,
        foodType: 0,
        minMoneyLoot: 0,
        maxMoneyLoot: 0,
        duration: 0,
        holidayId: 0,
        limitCategory: 0,
        artifactId: 0,
        requiredExpansion: 0,
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
        template.extended.bonding = ItemBondingType.ON_ACQUIRE;
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

    describe('getWeaponDPS()', () => {
      it('should calculate weapon DPS', () => {
        const dps = ItemSchema.getWeaponDPS(template);
        // (3.0 + 7.0) / 2 / (2000 / 1000) = 5.0 / 2 = 2.5
        expect(dps).toBeCloseTo(2.5, 2);
      });

      it('should return 0 for items with no damage', () => {
        template.extended.damages = [];
        expect(ItemSchema.getWeaponDPS(template)).toBe(0);
      });

      it('should return 0 for items with 0 delay', () => {
        template.extended.delay = 0;
        expect(ItemSchema.getWeaponDPS(template)).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle expensive items with bigint prices', () => {
      const mockRecord = new MockDB2Record({
        0: 123456,
        1: 'Expensive Mount',
        4: BigInt('999999999999'), // buyPrice > 2^32
        5: 250000000, // sellPrice (2.5 million gold)
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.buyPrice).toBe(BigInt('999999999999'));
      expect(item.sellPrice).toBe(250000000);
    });

    it('should handle items with all stat slots filled', () => {
      const mockRecord = new MockDB2Record({
        0: 12345,
        1: 'Super Item',
        // 10 stats
        20: ItemModType.STRENGTH,
        21: 10,
        22: ItemModType.AGILITY,
        23: 20,
        24: ItemModType.STAMINA,
        25: 30,
        26: ItemModType.INTELLECT,
        27: 40,
        28: ItemModType.SPIRIT,
        29: 50,
        30: ItemModType.CRIT_MELEE_RATING,
        31: 60,
        32: ItemModType.HASTE_MELEE_RATING,
        33: 70,
        34: ItemModType.HIT_MELEE_RATING,
        35: 80,
        36: ItemModType.DODGE_RATING,
        37: 90,
        38: ItemModType.PARRY_RATING,
        39: 100,
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.stats.length).toBe(10);
      expect(item.stats[9].type).toBe(ItemModType.PARRY_RATING);
      expect(item.stats[9].value).toBe(100);
    });

    it('should handle items with multiple damage types', () => {
      const mockRecord = new MockDB2Record({
        0: 12345,
        1: 'Elemental Weapon',
        // Physical damage
        46: 50.0,
        47: 100.0,
        48: 0,
        // Fire damage
        49: 10.0,
        50: 20.0,
        51: 2,
        // Shadow damage
        52: 5.0,
        53: 15.0,
        54: 5,
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.damages.length).toBe(3);
      expect(item.damages[0].damageType).toBe(0); // Physical
      expect(item.damages[1].damageType).toBe(2); // Fire
      expect(item.damages[2].damageType).toBe(5); // Shadow
    });
  });
});
