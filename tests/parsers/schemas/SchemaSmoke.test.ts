/**
 * Smoke tests for Schema implementations
 * Verifies basic parsing and factory functionality
 */

import { describe, it, expect } from '@jest/globals';
import { SpellSchema, SpellEntry } from '../../../src/parsers/schemas/SpellSchema';
import { ItemSchema, ItemEntry, ItemSparseEntry } from '../../../src/parsers/schemas/ItemSchema';
import {
  ChrClassesSchema,
  ChrClassesEntry,
  ChrClassesXPowerTypesSchema,
  ChrClassesXPowerTypesEntry,
  Classes,
  Powers,
  SpellFamilyNames,
  RolesMask,
} from '../../../src/parsers/schemas/ChrClassesSchema';
import {
  ChrRacesSchema,
  ChrRacesEntry,
  CharBaseInfoSchema,
  CharBaseInfoEntry,
  Races,
  TeamId,
  ChrRacesFlag,
} from '../../../src/parsers/schemas/ChrRacesSchema';
import {
  TalentSchema,
  TalentEntry,
  TalentLearnResult,
  MAX_TALENT_TIERS,
  MAX_TALENT_COLUMNS,
  MAX_TALENT_RANKS,
} from '../../../src/parsers/schemas/TalentSchema';
import {
  SpellEffectSchema,
  SpellEffectEntry,
  SpellEffectName,
  AuraType,
  SpellEffectAttributes,
  Targets,
  Mechanics,
} from '../../../src/parsers/schemas/SpellEffectSchema';
import {
  SchemaFactory,
  SchemaRegistry,
  isSpellEntry,
  isItemEntry,
  isItemSparseEntry,
} from '../../../src/parsers/schemas/SchemaFactory';
import { MockDB2Record } from './MockDB2Record';

describe('Schema Smoke Tests', () => {
  describe('SpellSchema', () => {
    it('should parse basic spell', () => {
      const mockRecord = new MockDB2Record({
        0: 8326, // id
        5: 0x00000100, // attributes
        95: 64, // schoolMask (field index 95)
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.id).toBe(8326);
      expect(spell.attributes).toBe(0x00000100);
      expect(spell.schoolMask).toBe(64);
    });

    it('should have helper methods', () => {
      const mockRecord = new MockDB2Record({ 0: 100, 5: 0x00000040, 95: 64 }); // 0x40 = PASSIVE
      const spell = SpellSchema.parse(mockRecord);

      // Test hasAttribute
      expect(SpellSchema.hasAttribute(spell, 0, 0x00000040)).toBe(true);

      // Test isPassive (SPELL_ATTR0_PASSIVE = 0x00000040)
      expect(SpellSchema.isPassive(spell)).toBe(true);

      // Test getSchoolNames (static method, doesn't need spell object)
      const schools = SpellSchema.getSchoolNames(64);
      expect(Array.isArray(schools)).toBe(true);
      expect(schools.length).toBeGreaterThan(0);
    });
  });

  describe('ItemSchema', () => {
    it('should parse basic item', () => {
      const mockRecord = new MockDB2Record({
        0: 25, // id
        1: 2, // classId
        2: 7, // subclassId
      });

      const item = ItemSchema.parseBasic(mockRecord);

      expect(item.id).toBe(25);
      expect(item.classId).toBe(2);
      expect(item.subclassId).toBe(7);
    });

    it('should parse sparse item', () => {
      const mockRecord = new MockDB2Record({
        0: 25, // id
        1: 'Worn Shortsword', // name
        5: 18, // sellPrice
      });

      const item = ItemSchema.parseSparse(mockRecord);

      expect(item.id).toBe(25);
      expect(item.name).toBe('Worn Shortsword');
      expect(item.sellPrice).toBe(18);
    });

    it('should combine basic and sparse', () => {
      const basicRecord = new MockDB2Record({ 0: 25, 1: 2 });
      const sparseRecord = new MockDB2Record({ 0: 25, 1: 'Test', 5: 10 });

      const basic = ItemSchema.parseBasic(basicRecord);
      const sparse = ItemSchema.parseSparse(sparseRecord);
      const template = ItemSchema.combine(basic, sparse);

      expect(template.basic.id).toBe(25);
      expect(template.extended.name).toBe('Test');
    });

    it('should have helper methods', () => {
      const basicRecord = new MockDB2Record({ 0: 25, 1: 2 });
      const sparseRecord = new MockDB2Record({ 0: 25, 1: 'Test', 5: 10, 10: 15 });

      const template = ItemSchema.combine(
        ItemSchema.parseBasic(basicRecord),
        ItemSchema.parseSparse(sparseRecord)
      );

      expect(ItemSchema.isWeapon(template)).toBe(true);
      expect(ItemSchema.canSellToVendor(template)).toBe(true);
      expect(typeof ItemSchema.getQualityName(0)).toBe('string');
    });
  });

  describe('SchemaFactory', () => {
    it('should register schemas', () => {
      expect(SchemaRegistry.hasSchemaForFile('Spell.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('Item.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('ItemSparse.db2')).toBe(true);

      // Week 5 schemas
      expect(SchemaRegistry.hasSchemaForFile('ChrClasses.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('ChrClasses_X_PowerTypes.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('ChrRaces.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('CharBaseInfo.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('Talent.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('SpellEffect.db2')).toBe(true);
    });

    it('should parse by filename', () => {
      const mockRecord = new MockDB2Record({ 0: 8326 });
      const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', mockRecord);

      expect(spell).not.toBeNull();
      expect(spell!.id).toBe(8326);
    });

    it('should parse by table hash', () => {
      const mockRecord = new MockDB2Record({ 0: 8326 });
      const spell = SchemaFactory.parseByTableHash<SpellEntry>(0x8c2c0c55, mockRecord);

      expect(spell).not.toBeNull();
      expect(spell!.id).toBe(8326);
    });

    it('should return null for unknown file', () => {
      const mockRecord = new MockDB2Record({ 0: 1 });
      const result = SchemaFactory.parseByFileName('Unknown.db2', mockRecord);

      expect(result).toBeNull();
    });

    it('should have type-safe parsing methods', () => {
      const mockRecord = new MockDB2Record({ 0: 100 });

      const spell = SchemaFactory.parseSpell(mockRecord);
      expect(spell.id).toBe(100);

      const item = SchemaFactory.parseItemBasic(mockRecord);
      expect(item.id).toBe(100);

      const sparse = SchemaFactory.parseItemSparse(mockRecord);
      expect(sparse.id).toBe(100);
    });

    it('should provide schema info', () => {
      const info = SchemaFactory.getSchemaInfo('Spell.db2');

      expect(info).not.toBeNull();
      expect(info!.name).toBe('Spell');
      expect(info!.fileNames.length).toBeGreaterThan(0);
    });

    it('should list supported files', () => {
      const files = SchemaFactory.getSupportedFiles();

      expect(files.length).toBeGreaterThanOrEqual(9); // 3 original + 6 Week 5
      expect(files).toContain('spell.db2');
      expect(files).toContain('item.db2');
      expect(files).toContain('itemsparse.db2');

      // Week 5 schemas
      expect(files).toContain('chrclasses.db2');
      expect(files).toContain('chrclasses_x_powertypes.db2');
      expect(files).toContain('chrraces.db2');
      expect(files).toContain('charbaseinfo.db2');
      expect(files).toContain('talent.db2');
      expect(files).toContain('spelleffect.db2');
    });

    it('should parse Week 5 schemas by filename', () => {
      // ChrClasses
      const chrClassesRecord = new MockDB2Record({ 0: 'Warrior', 29: Classes.CLASS_WARRIOR });
      const chrClass = SchemaFactory.parseByFileName<ChrClassesEntry>('ChrClasses.db2', chrClassesRecord);
      expect(chrClass).not.toBeNull();
      expect(chrClass?.name).toBe('Warrior');

      // ChrRaces
      const chrRacesRecord = new MockDB2Record({ 0: Races.RACE_HUMAN, 1: 'Human' });
      const chrRace = SchemaFactory.parseByFileName<ChrRacesEntry>('ChrRaces.db2', chrRacesRecord);
      expect(chrRace).not.toBeNull();
      expect(chrRace?.id).toBe(Races.RACE_HUMAN);

      // Talent
      const talentRecord = new MockDB2Record({ 0: 1, 2: 0, 4: 0 });
      const talent = SchemaFactory.parseByFileName<TalentEntry>('Talent.db2', talentRecord);
      expect(talent).not.toBeNull();
      expect(talent?.id).toBe(1);

      // SpellEffect
      const spellEffectRecord = new MockDB2Record({
        0: 100001,
        4: SpellEffectName.SCHOOL_DAMAGE,
        35: 12345,
      });
      const spellEffect = SchemaFactory.parseByFileName<SpellEffectEntry>('SpellEffect.db2', spellEffectRecord);
      expect(spellEffect).not.toBeNull();
      expect(spellEffect?.id).toBe(100001);
      expect(spellEffect?.effect).toBe(SpellEffectName.SCHOOL_DAMAGE);
    });

    it('should parse Week 5 schemas by table hash', () => {
      // ChrClasses (0x9871C02B)
      const chrClassesRecord = new MockDB2Record({ 29: Classes.CLASS_MAGE });
      const chrClass = SchemaFactory.parseByTableHash<ChrClassesEntry>(0x9871c02b, chrClassesRecord);
      expect(chrClass).not.toBeNull();
      expect(chrClass?.id).toBe(Classes.CLASS_MAGE);

      // SpellEffect (0x239B1B53)
      const spellEffectRecord = new MockDB2Record({ 0: 200002, 4: SpellEffectName.HEAL });
      const spellEffect = SchemaFactory.parseByTableHash<SpellEffectEntry>(0x239b1b53, spellEffectRecord);
      expect(spellEffect).not.toBeNull();
      expect(spellEffect?.id).toBe(200002);
      expect(spellEffect?.effect).toBe(SpellEffectName.HEAL);
    });

    it('should provide schema info for Week 5 schemas', () => {
      const chrClassesInfo = SchemaFactory.getSchemaInfo('ChrClasses.db2');
      expect(chrClassesInfo).not.toBeNull();
      expect(chrClassesInfo?.name).toBe('ChrClasses');
      expect(chrClassesInfo?.fileNames).toContain('ChrClasses.dbc');
      expect(chrClassesInfo?.tableHashes).toContain('0x9871C02B');

      const spellEffectInfo = SchemaFactory.getSchemaInfo('SpellEffect.db2');
      expect(spellEffectInfo).not.toBeNull();
      expect(spellEffectInfo?.name).toBe('SpellEffect');
      expect(spellEffectInfo?.tableHashes).toContain('0x239B1B53');
    });
  });

  describe('Type Guards', () => {
    it('should validate SpellEntry', () => {
      const mockRecord = new MockDB2Record({ 0: 100, 5: 1 });
      const spell = SpellSchema.parse(mockRecord);

      expect(isSpellEntry(spell)).toBe(true);
      expect(isItemEntry(spell)).toBe(false);
    });

    it('should validate ItemEntry', () => {
      const mockRecord = new MockDB2Record({ 0: 100, 1: 2 });
      const item = ItemSchema.parseBasic(mockRecord);

      expect(isItemEntry(item)).toBe(true);
      expect(isSpellEntry(item)).toBe(false);
    });

    it('should validate ItemSparseEntry', () => {
      const mockRecord = new MockDB2Record({ 0: 100, 1: 'Test' });
      const item = ItemSchema.parseSparse(mockRecord);

      expect(isItemSparseEntry(item)).toBe(true);
      expect(isItemEntry(item)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isSpellEntry(null as any)).toBe(false);
      expect(isItemEntry(undefined as any)).toBe(false);
      expect(isItemSparseEntry(null as any)).toBe(false);
    });
  });

  describe('ChrClassesSchema', () => {
    it('should parse basic class entry', () => {
      const mockRecord = new MockDB2Record({
        0: 'Warrior', // name
        1: 'WARRIOR', // filename
        29: Classes.CLASS_WARRIOR, // id
        31: 0, // primaryStatPriority (Strength)
        32: Powers.POWER_RAGE, // displayPower
        36: SpellFamilyNames.SPELLFAMILY_WARRIOR, // spellClassSet
        37: 199, // classColorR
        38: 156, // classColorG
        39: 110, // classColorB
        40: RolesMask.ROLE_TANK | RolesMask.ROLE_DPS, // rolesMask (0x5)
      });

      const classEntry = ChrClassesSchema.parse(mockRecord);

      expect(classEntry.name).toBe('Warrior');
      expect(classEntry.filename).toBe('WARRIOR');
      expect(classEntry.id).toBe(Classes.CLASS_WARRIOR);
      expect(classEntry.primaryStatPriority).toBe(0); // Strength
      expect(classEntry.displayPower).toBe(Powers.POWER_RAGE);
      expect(classEntry.spellClassSet).toBe(SpellFamilyNames.SPELLFAMILY_WARRIOR);
      expect(classEntry.classColorR).toBe(199);
      expect(classEntry.classColorG).toBe(156);
      expect(classEntry.classColorB).toBe(110);
      expect(classEntry.rolesMask).toBe(0x5); // Tank + DPS
    });

    it('should have helper methods', () => {
      // Test getClassName
      expect(ChrClassesSchema.getClassName(Classes.CLASS_WARRIOR)).toBe('Warrior');
      expect(ChrClassesSchema.getClassName(Classes.CLASS_MAGE)).toBe('Mage');
      expect(ChrClassesSchema.getClassName(Classes.CLASS_EVOKER)).toBe('Evoker');
      expect(ChrClassesSchema.getClassName(99)).toBe('Unknown');

      // Test getClassColor
      const mockRecord = new MockDB2Record({
        37: 199, // classColorR
        38: 156, // classColorG
        39: 110, // classColorB
      });
      const classEntry = ChrClassesSchema.parse(mockRecord);
      const color = ChrClassesSchema.getClassColor(classEntry);
      expect(color).toBe('#C79C6E'); // Warrior brown

      // Test getPowerTypeName
      expect(ChrClassesSchema.getPowerTypeName(Powers.POWER_MANA)).toBe('Mana');
      expect(ChrClassesSchema.getPowerTypeName(Powers.POWER_RAGE)).toBe('Rage');
      expect(ChrClassesSchema.getPowerTypeName(Powers.POWER_ENERGY)).toBe('Energy');
      expect(ChrClassesSchema.getPowerTypeName(99)).toBe('Unknown');

      // Test getSpellFamilyName
      expect(ChrClassesSchema.getSpellFamilyName(SpellFamilyNames.SPELLFAMILY_WARRIOR)).toBe('Warrior');
      expect(ChrClassesSchema.getSpellFamilyName(SpellFamilyNames.SPELLFAMILY_MAGE)).toBe('Mage');
      expect(ChrClassesSchema.getSpellFamilyName(SpellFamilyNames.SPELLFAMILY_EVOKER)).toBe('Evoker');
      expect(ChrClassesSchema.getSpellFamilyName(999)).toBe('Unknown');
    });

    it('should check roles correctly', () => {
      const mockRecord = new MockDB2Record({
        40: RolesMask.ROLE_TANK | RolesMask.ROLE_DPS, // rolesMask
      });
      const classEntry = ChrClassesSchema.parse(mockRecord);

      expect(ChrClassesSchema.hasRole(classEntry, RolesMask.ROLE_TANK)).toBe(true);
      expect(ChrClassesSchema.hasRole(classEntry, RolesMask.ROLE_DPS)).toBe(true);
      expect(ChrClassesSchema.hasRole(classEntry, RolesMask.ROLE_HEALER)).toBe(false);
    });

    it('should get all roles', () => {
      const mockRecord = new MockDB2Record({
        40: RolesMask.ROLE_TANK | RolesMask.ROLE_HEALER | RolesMask.ROLE_DPS, // All roles
      });
      const classEntry = ChrClassesSchema.parse(mockRecord);

      const roles = ChrClassesSchema.getRoles(classEntry);
      expect(roles).toContain('Tank');
      expect(roles).toContain('Healer');
      expect(roles).toContain('DPS');
      expect(roles.length).toBe(3);
    });

    it('should get primary stat name', () => {
      const mockRecordStr = new MockDB2Record({ 31: 0 }); // Strength
      const mockRecordAgi = new MockDB2Record({ 31: 2 }); // Agility
      const mockRecordInt = new MockDB2Record({ 31: 3 }); // Intellect
      const mockRecordNone = new MockDB2Record({ 31: -1 }); // None

      expect(ChrClassesSchema.getPrimaryStatName(ChrClassesSchema.parse(mockRecordStr))).toBe('Strength');
      expect(ChrClassesSchema.getPrimaryStatName(ChrClassesSchema.parse(mockRecordAgi))).toBe('Agility');
      expect(ChrClassesSchema.getPrimaryStatName(ChrClassesSchema.parse(mockRecordInt))).toBe('Intellect');
      expect(ChrClassesSchema.getPrimaryStatName(ChrClassesSchema.parse(mockRecordNone))).toBe('None');
    });

    it('should validate class IDs', () => {
      expect(ChrClassesSchema.isValidClass(Classes.CLASS_WARRIOR)).toBe(true);
      expect(ChrClassesSchema.isValidClass(Classes.CLASS_EVOKER)).toBe(true);
      expect(ChrClassesSchema.isValidClass(Classes.CLASS_NONE)).toBe(false);
      expect(ChrClassesSchema.isValidClass(Classes.MAX_CLASSES)).toBe(false);
      expect(ChrClassesSchema.isValidClass(99)).toBe(false);
    });
  });

  describe('ChrClassesXPowerTypesSchema', () => {
    it('should parse power type mapping', () => {
      const mockRecord = new MockDB2Record({
        0: 100, // id
        1: Powers.POWER_RAGE, // powerType
        2: Classes.CLASS_WARRIOR, // classID
      });

      const entry = ChrClassesXPowerTypesSchema.parse(mockRecord);

      expect(entry.id).toBe(100);
      expect(entry.powerType).toBe(Powers.POWER_RAGE);
      expect(entry.classID).toBe(Classes.CLASS_WARRIOR);
    });

    it('should group power types by class', () => {
      const entries: ChrClassesXPowerTypesEntry[] = [
        { id: 1, powerType: Powers.POWER_RAGE, classID: Classes.CLASS_WARRIOR },
        { id: 2, powerType: Powers.POWER_MANA, classID: Classes.CLASS_MAGE },
        { id: 3, powerType: Powers.POWER_ENERGY, classID: Classes.CLASS_ROGUE },
        { id: 4, powerType: Powers.POWER_COMBO_POINTS, classID: Classes.CLASS_ROGUE },
      ];

      const grouped = ChrClassesXPowerTypesSchema.groupByClass(entries);

      expect(grouped.size).toBe(3);
      expect(grouped.get(Classes.CLASS_WARRIOR)).toEqual([Powers.POWER_RAGE]);
      expect(grouped.get(Classes.CLASS_MAGE)).toEqual([Powers.POWER_MANA]);
      expect(grouped.get(Classes.CLASS_ROGUE)).toEqual([Powers.POWER_ENERGY, Powers.POWER_COMBO_POINTS]);
    });
  });

  describe('ChrRacesSchema', () => {
    it('should parse basic race entry', () => {
      const mockRecord = new MockDB2Record({
        0: Races.RACE_HUMAN, // id
        1: 'hu', // clientPrefix
        2: 'HUMAN', // clientFileString
        3: 'Human', // name
        4: 'Human', // nameFemale
        16: 0x000004, // flags (CanMount)
        17: 1, // factionID
        31: 1, // startingLevel
        47: TeamId.TEAM_ALLIANCE, // alliance
      });

      const race = ChrRacesSchema.parse(mockRecord);

      expect(race.id).toBe(Races.RACE_HUMAN);
      expect(race.clientPrefix).toBe('hu');
      expect(race.clientFileString).toBe('HUMAN');
      expect(race.name).toBe('Human');
      expect(race.nameFemale).toBe('Human');
      expect(race.flags).toBe(0x000004);
      expect(race.factionID).toBe(1);
      expect(race.startingLevel).toBe(1);
      expect(race.alliance).toBe(TeamId.TEAM_ALLIANCE);
    });

    it('should have helper methods', () => {
      // Test getRaceName
      expect(ChrRacesSchema.getRaceName(Races.RACE_HUMAN)).toBe('Human');
      expect(ChrRacesSchema.getRaceName(Races.RACE_ORC)).toBe('Orc');
      expect(ChrRacesSchema.getRaceName(Races.RACE_NIGHTELF)).toBe('Night Elf');
      expect(ChrRacesSchema.getRaceName(Races.RACE_BLOODELF)).toBe('Blood Elf');
      expect(ChrRacesSchema.getRaceName(Races.RACE_VOID_ELF)).toBe('Void Elf');
      expect(ChrRacesSchema.getRaceName(Races.RACE_DRACTHYR_ALLIANCE)).toBe('Dracthyr');
      expect(ChrRacesSchema.getRaceName(Races.RACE_EARTHEN_DWARF_ALLIANCE)).toBe('Earthen');
      expect(ChrRacesSchema.getRaceName(999)).toBe('Unknown');

      // Test getFactionName
      expect(ChrRacesSchema.getFactionName(TeamId.TEAM_ALLIANCE)).toBe('Alliance');
      expect(ChrRacesSchema.getFactionName(TeamId.TEAM_HORDE)).toBe('Horde');
      expect(ChrRacesSchema.getFactionName(TeamId.TEAM_NEUTRAL)).toBe('Neutral');
    });

    it('should check faction correctly', () => {
      const allianceRecord = new MockDB2Record({ 47: TeamId.TEAM_ALLIANCE });
      const hordeRecord = new MockDB2Record({ 47: TeamId.TEAM_HORDE });
      const neutralRecord = new MockDB2Record({ 47: TeamId.TEAM_NEUTRAL });

      const alliance = ChrRacesSchema.parse(allianceRecord);
      const horde = ChrRacesSchema.parse(hordeRecord);
      const neutral = ChrRacesSchema.parse(neutralRecord);

      expect(ChrRacesSchema.getFaction(alliance)).toBe(TeamId.TEAM_ALLIANCE);
      expect(ChrRacesSchema.getFaction(horde)).toBe(TeamId.TEAM_HORDE);
      expect(ChrRacesSchema.getFaction(neutral)).toBe(TeamId.TEAM_NEUTRAL);
    });

    it('should check race flags', () => {
      const mockRecord = new MockDB2Record({
        16: ChrRacesFlag.CanMount | ChrRacesFlag.IsAlliedRace | ChrRacesFlag.AlternateForm, // flags
      });
      const race = ChrRacesSchema.parse(mockRecord);

      expect(ChrRacesSchema.hasFlag(race, ChrRacesFlag.CanMount)).toBe(true);
      expect(ChrRacesSchema.hasFlag(race, ChrRacesFlag.IsAlliedRace)).toBe(true);
      expect(ChrRacesSchema.hasFlag(race, ChrRacesFlag.AlternateForm)).toBe(true);
      expect(ChrRacesSchema.hasFlag(race, ChrRacesFlag.NPCOnly)).toBe(false);
      expect(ChrRacesSchema.hasFlag(race, ChrRacesFlag.NotSelectable)).toBe(false);
    });

    it('should identify playable races', () => {
      const playableRecord = new MockDB2Record({
        16: ChrRacesFlag.CanMount, // Only CanMount flag
      });
      const npcRecord = new MockDB2Record({
        16: ChrRacesFlag.NPCOnly, // NPC-only
      });
      const notSelectableRecord = new MockDB2Record({
        16: ChrRacesFlag.NotSelectable, // Not selectable
      });

      const playable = ChrRacesSchema.parse(playableRecord);
      const npc = ChrRacesSchema.parse(npcRecord);
      const notSelectable = ChrRacesSchema.parse(notSelectableRecord);

      expect(ChrRacesSchema.isPlayable(playable)).toBe(true);
      expect(ChrRacesSchema.isPlayable(npc)).toBe(false);
      expect(ChrRacesSchema.isPlayable(notSelectable)).toBe(false);
    });

    it('should identify allied races', () => {
      const alliedRecord = new MockDB2Record({
        16: ChrRacesFlag.IsAlliedRace,
      });
      const normalRecord = new MockDB2Record({
        16: ChrRacesFlag.CanMount,
      });

      const allied = ChrRacesSchema.parse(alliedRecord);
      const normal = ChrRacesSchema.parse(normalRecord);

      expect(ChrRacesSchema.isAlliedRace(allied)).toBe(true);
      expect(ChrRacesSchema.isAlliedRace(normal)).toBe(false);
    });

    it('should identify alternate form races', () => {
      const altFormRecord = new MockDB2Record({
        16: ChrRacesFlag.AlternateForm, // Worgen/Dracthyr
      });
      const normalRecord = new MockDB2Record({
        16: ChrRacesFlag.CanMount,
      });

      const altForm = ChrRacesSchema.parse(altFormRecord);
      const normal = ChrRacesSchema.parse(normalRecord);

      expect(ChrRacesSchema.hasAlternateForm(altForm)).toBe(true);
      expect(ChrRacesSchema.hasAlternateForm(normal)).toBe(false);
    });

    it('should identify mountable races', () => {
      const mountableRecord = new MockDB2Record({
        16: ChrRacesFlag.CanMount,
      });
      const notMountableRecord = new MockDB2Record({
        16: 0, // No flags
      });

      const mountable = ChrRacesSchema.parse(mountableRecord);
      const notMountable = ChrRacesSchema.parse(notMountableRecord);

      expect(ChrRacesSchema.canMount(mountable)).toBe(true);
      expect(ChrRacesSchema.canMount(notMountable)).toBe(false);
    });

    it('should validate race IDs', () => {
      expect(ChrRacesSchema.isValidRace(Races.RACE_HUMAN)).toBe(true);
      expect(ChrRacesSchema.isValidRace(Races.RACE_ORC)).toBe(true);
      expect(ChrRacesSchema.isValidRace(Races.RACE_EARTHEN_DWARF_ALLIANCE)).toBe(true);
      expect(ChrRacesSchema.isValidRace(Races.RACE_NONE)).toBe(false);
      expect(ChrRacesSchema.isValidRace(Races.MAX_RACES)).toBe(false);
      expect(ChrRacesSchema.isValidRace(999)).toBe(false);
    });

    it('should list Alliance races', () => {
      const allianceRaces = ChrRacesSchema.getAllianceRaces();

      expect(allianceRaces).toContain(Races.RACE_HUMAN);
      expect(allianceRaces).toContain(Races.RACE_DWARF);
      expect(allianceRaces).toContain(Races.RACE_NIGHTELF);
      expect(allianceRaces).toContain(Races.RACE_GNOME);
      expect(allianceRaces).toContain(Races.RACE_DRAENEI);
      expect(allianceRaces).toContain(Races.RACE_WORGEN);
      expect(allianceRaces).toContain(Races.RACE_VOID_ELF);
      expect(allianceRaces).toContain(Races.RACE_DRACTHYR_ALLIANCE);
      expect(allianceRaces).toContain(Races.RACE_EARTHEN_DWARF_ALLIANCE);
      expect(allianceRaces.length).toBe(14);

      // Should not contain Horde races
      expect(allianceRaces).not.toContain(Races.RACE_ORC);
      expect(allianceRaces).not.toContain(Races.RACE_UNDEAD_PLAYER);
    });

    it('should list Horde races', () => {
      const hordeRaces = ChrRacesSchema.getHordeRaces();

      expect(hordeRaces).toContain(Races.RACE_ORC);
      expect(hordeRaces).toContain(Races.RACE_UNDEAD_PLAYER);
      expect(hordeRaces).toContain(Races.RACE_TAUREN);
      expect(hordeRaces).toContain(Races.RACE_TROLL);
      expect(hordeRaces).toContain(Races.RACE_BLOODELF);
      expect(hordeRaces).toContain(Races.RACE_GOBLIN);
      expect(hordeRaces).toContain(Races.RACE_NIGHTBORNE);
      expect(hordeRaces).toContain(Races.RACE_DRACTHYR_HORDE);
      expect(hordeRaces).toContain(Races.RACE_EARTHEN_DWARF_HORDE);
      expect(hordeRaces.length).toBe(14);

      // Should not contain Alliance races
      expect(hordeRaces).not.toContain(Races.RACE_HUMAN);
      expect(hordeRaces).not.toContain(Races.RACE_DWARF);
    });
  });

  describe('CharBaseInfoSchema', () => {
    it('should parse race/class combination', () => {
      const mockRecord = new MockDB2Record({
        0: 100, // id
        1: Races.RACE_HUMAN, // raceID
        2: Classes.CLASS_WARRIOR, // classID
        3: Races.RACE_ORC, // otherFactionRaceID (opposite faction equivalent)
      });

      const entry = CharBaseInfoSchema.parse(mockRecord);

      expect(entry.id).toBe(100);
      expect(entry.raceID).toBe(Races.RACE_HUMAN);
      expect(entry.classID).toBe(Classes.CLASS_WARRIOR);
      expect(entry.otherFactionRaceID).toBe(Races.RACE_ORC);
    });
  });

  describe('TalentSchema', () => {
    it('should parse basic talent', () => {
      const mockRecord = new MockDB2Record({
        0: 100, // id
        1: 'Increases damage by 10%', // description
        2: 0, // tierID (row 0)
        3: 0, // flags
        4: 0, // columnIndex (column 0)
        5: 0, // tabID (deprecated)
        6: Classes.CLASS_WARRIOR, // classID
        7: 71, // specID (Arms Warrior)
        8: 12345, // spellID
        9: 0, // overridesSpellID
        10: 0, // requiredSpellID
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(talent.id).toBe(100);
      expect(talent.description).toBe('Increases damage by 10%');
      expect(talent.tierID).toBe(0);
      expect(talent.flags).toBe(0);
      expect(talent.columnIndex).toBe(0);
      expect(talent.classID).toBe(Classes.CLASS_WARRIOR);
      expect(talent.specID).toBe(71);
      expect(talent.spellID).toBe(12345);
    });

    it('should parse multi-rank talent', () => {
      const mockRecord = new MockDB2Record({
        0: 200, // id
        1: 'Multi-rank talent', // description
        2: 1, // tierID
        4: 1, // columnIndex
        6: Classes.CLASS_MAGE, // classID
        7: 0, // specID (all specs)
        8: 54321, // spellID
        13: 100, // spellRank[0] - Rank 1
        14: 101, // spellRank[1] - Rank 2
        15: 102, // spellRank[2] - Rank 3
        16: 0, // spellRank[3] - No rank 4
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(talent.id).toBe(200);
      expect(talent.tierID).toBe(1);
      expect(talent.columnIndex).toBe(1);
      expect(talent.classID).toBe(Classes.CLASS_MAGE);
      expect(talent.spellRank[0]).toBe(100); // Rank 1
      expect(talent.spellRank[1]).toBe(101); // Rank 2
      expect(talent.spellRank[2]).toBe(102); // Rank 3
      expect(talent.spellRank[3]).toBe(0); // No rank 4
    });

    it('should parse talent with prerequisites', () => {
      const mockRecord = new MockDB2Record({
        0: 300, // id
        6: Classes.CLASS_PRIEST, // classID
        22: 50, // prereqTalent[0]
        23: 60, // prereqTalent[1]
        24: 0, // prereqTalent[2] - No third prerequisite
        25: 3, // prereqRank[0] - Requires rank 3 of talent 50
        26: 1, // prereqRank[1] - Requires rank 1 of talent 60
        27: 0, // prereqRank[2]
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(talent.prereqTalent[0]).toBe(50);
      expect(talent.prereqTalent[1]).toBe(60);
      expect(talent.prereqTalent[2]).toBe(0);
      expect(talent.prereqRank[0]).toBe(3);
      expect(talent.prereqRank[1]).toBe(1);
    });

    it('should check prerequisites', () => {
      const withPrereqRecord = new MockDB2Record({
        22: 100, // prereqTalent[0]
      });
      const noPrereqRecord = new MockDB2Record({
        22: 0, // No prerequisites
        23: 0,
        24: 0,
      });

      const withPrereq = TalentSchema.parse(withPrereqRecord);
      const noPrereq = TalentSchema.parse(noPrereqRecord);

      expect(TalentSchema.hasPrerequisites(withPrereq)).toBe(true);
      expect(TalentSchema.hasPrerequisites(noPrereq)).toBe(false);
    });

    it('should count prerequisites', () => {
      const mockRecord = new MockDB2Record({
        22: 100, // prereqTalent[0]
        23: 200, // prereqTalent[1]
        24: 0, // prereqTalent[2] - No third
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(TalentSchema.getPrerequisiteCount(talent)).toBe(2);
    });

    it('should check multi-rank', () => {
      const multiRankRecord = new MockDB2Record({
        13: 100, // spellRank[0]
        14: 101, // spellRank[1]
        15: 102, // spellRank[2]
      });
      const singleRankRecord = new MockDB2Record({
        13: 100, // spellRank[0]
        14: 0, // No rank 2
      });

      const multiRank = TalentSchema.parse(multiRankRecord);
      const singleRank = TalentSchema.parse(singleRankRecord);

      expect(TalentSchema.hasMultipleRanks(multiRank)).toBe(true);
      expect(TalentSchema.hasMultipleRanks(singleRank)).toBe(false);
    });

    it('should count ranks', () => {
      const mockRecord = new MockDB2Record({
        13: 100, // Rank 1
        14: 101, // Rank 2
        15: 102, // Rank 3
        16: 103, // Rank 4
        17: 104, // Rank 5
        18: 0, // No rank 6
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(TalentSchema.getRankCount(talent)).toBe(5);
    });

    it('should get max rank spell ID', () => {
      const mockRecord = new MockDB2Record({
        13: 100, // Rank 1
        14: 101, // Rank 2
        15: 102, // Rank 3 (max)
        16: 0,
      });

      const talent = TalentSchema.parse(mockRecord);

      expect(TalentSchema.getMaxRankSpellID(talent)).toBe(102);
    });

    it('should check spell flags', () => {
      const grantsSpellRecord = new MockDB2Record({ 8: 12345 }); // spellID
      const overridesSpellRecord = new MockDB2Record({ 9: 54321 }); // overridesSpellID
      const requiresSpellRecord = new MockDB2Record({ 10: 99999 }); // requiredSpellID

      const grantsSpell = TalentSchema.parse(grantsSpellRecord);
      const overridesSpell = TalentSchema.parse(overridesSpellRecord);
      const requiresSpell = TalentSchema.parse(requiresSpellRecord);

      expect(TalentSchema.grantsSpell(grantsSpell)).toBe(true);
      expect(TalentSchema.overridesSpell(overridesSpell)).toBe(true);
      expect(TalentSchema.requiresSpell(requiresSpell)).toBe(true);

      const noSpellRecord = new MockDB2Record({ 8: 0, 9: 0, 10: 0 });
      const noSpell = TalentSchema.parse(noSpellRecord);

      expect(TalentSchema.grantsSpell(noSpell)).toBe(false);
      expect(TalentSchema.overridesSpell(noSpell)).toBe(false);
      expect(TalentSchema.requiresSpell(noSpell)).toBe(false);
    });

    it('should validate tier, column, rank', () => {
      expect(TalentSchema.isValidTier(0)).toBe(true);
      expect(TalentSchema.isValidTier(6)).toBe(true);
      expect(TalentSchema.isValidTier(7)).toBe(false);
      expect(TalentSchema.isValidTier(-1)).toBe(false);

      expect(TalentSchema.isValidColumn(0)).toBe(true);
      expect(TalentSchema.isValidColumn(3)).toBe(true);
      expect(TalentSchema.isValidColumn(4)).toBe(false);
      expect(TalentSchema.isValidColumn(-1)).toBe(false);

      expect(TalentSchema.isValidRank(1)).toBe(true);
      expect(TalentSchema.isValidRank(9)).toBe(true);
      expect(TalentSchema.isValidRank(0)).toBe(false);
      expect(TalentSchema.isValidRank(10)).toBe(false);
    });

    it('should check all-class and all-spec talents', () => {
      const allClassRecord = new MockDB2Record({ 6: -1, 7: 0 }); // classID=-1, specID=0
      const specificClassRecord = new MockDB2Record({ 6: Classes.CLASS_WARRIOR, 7: 0 });
      const specificSpecRecord = new MockDB2Record({ 6: Classes.CLASS_WARRIOR, 7: 71 });

      const allClass = TalentSchema.parse(allClassRecord);
      const specificClass = TalentSchema.parse(specificClassRecord);
      const specificSpec = TalentSchema.parse(specificSpecRecord);

      expect(TalentSchema.isAllClassTalent(allClass)).toBe(true);
      expect(TalentSchema.isAllClassTalent(specificClass)).toBe(false);

      expect(TalentSchema.isAllSpecTalent(allClass)).toBe(true);
      expect(TalentSchema.isAllSpecTalent(specificClass)).toBe(true);
      expect(TalentSchema.isAllSpecTalent(specificSpec)).toBe(false);
    });

    it('should get prerequisites with ranks', () => {
      const mockRecord = new MockDB2Record({
        22: 100, // prereqTalent[0]
        23: 200, // prereqTalent[1]
        24: 300, // prereqTalent[2]
        25: 3, // prereqRank[0] - Requires rank 3
        26: 0, // prereqRank[1] - Defaults to rank 1
        27: 5, // prereqRank[2] - Requires rank 5
      });

      const talent = TalentSchema.parse(mockRecord);
      const prerequisites = TalentSchema.getPrerequisites(talent);

      expect(prerequisites.length).toBe(3);
      expect(prerequisites[0]).toEqual({ talentID: 100, minRank: 3 });
      expect(prerequisites[1]).toEqual({ talentID: 200, minRank: 1 }); // Defaults to 1
      expect(prerequisites[2]).toEqual({ talentID: 300, minRank: 5 });
    });

    it('should get all spell IDs', () => {
      const mockRecord = new MockDB2Record({
        8: 12345, // spellID
        13: 100, // spellRank[0]
        14: 101, // spellRank[1]
        15: 102, // spellRank[2]
      });

      const talent = TalentSchema.parse(mockRecord);
      const spellIDs = TalentSchema.getAllSpellIDs(talent);

      expect(spellIDs).toContain(12345);
      expect(spellIDs).toContain(100);
      expect(spellIDs).toContain(101);
      expect(spellIDs).toContain(102);
      expect(spellIDs.length).toBe(4);
    });

    it('should get talent position', () => {
      const mockRecord = new MockDB2Record({
        2: 3, // tierID (row 3)
        4: 2, // columnIndex (column 2)
        6: Classes.CLASS_DRUID, // classID
      });

      const talent = TalentSchema.parse(mockRecord);
      const position = TalentSchema.getPosition(talent);

      expect(position.classID).toBe(Classes.CLASS_DRUID);
      expect(position.tierID).toBe(3);
      expect(position.columnIndex).toBe(2);
    });
  });

  describe('SpellEffectSchema', () => {
    it('should parse basic spell effect entry', () => {
      const mockRecord = new MockDB2Record({
        0: 100001, // id
        1: 0, // effectAura (none, not an aura effect)
        2: 0, // difficultyID (normal)
        3: 0, // effectIndex (first effect)
        4: SpellEffectName.SCHOOL_DAMAGE, // effect (damage)
        5: 0.0, // effectAmplitude
        6: SpellEffectAttributes.IS_HARMFUL, // effectAttributes
        7: 0, // effectAuraPeriod
        8: 0.85, // effectBonusCoefficient
        9: 0.0, // effectChainAmplitude
        10: 0, // effectChainTargets
        11: 0, // effectItemType
        12: Mechanics.NONE, // effectMechanic
        13: 0.0, // effectPointsPerResource
        14: 0.0, // effectPosFacing
        15: 0.0, // effectRealPointsPerLevel
        16: 0, // effectTriggerSpell
        17: 0.0, // bonusCoefficientFromAP
        18: 1.0, // pvpMultiplier
        19: 1.0, // coefficient
        20: 0.0, // variance
        21: 0.0, // resourceCoefficient
        22: 1.0, // groupSizeBasePointsCoefficient
        23: 100.0, // effectBasePoints (100 damage)
        24: -1, // scalingClass (all classes)
        25: 0, // effectMiscValue[0]
        26: 0, // effectMiscValue[1]
        27: 0, // effectRadiusIndex[0]
        28: 0, // effectRadiusIndex[1]
        29: 0, // effectSpellClassMask[0]
        30: 0, // effectSpellClassMask[1]
        31: 0, // effectSpellClassMask[2]
        32: 0, // effectSpellClassMask[3]
        33: Targets.UNIT_TARGET_ENEMY, // implicitTarget[0] (target enemy)
        34: 0, // implicitTarget[1] (no secondary target)
        35: 12345, // spellID (parent spell)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(effect.id).toBe(100001);
      expect(effect.effect).toBe(SpellEffectName.SCHOOL_DAMAGE);
      expect(effect.effectIndex).toBe(0);
      expect(effect.effectBasePoints).toBe(100.0);
      expect(effect.effectBonusCoefficient).toBe(0.85);
      expect(effect.spellID).toBe(12345);
    });

    it('should identify damage effects', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.SCHOOL_DAMAGE,
        23: 100.0,
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.isDamageEffect(effect)).toBe(true);
      expect(SpellEffectSchema.isHealEffect(effect)).toBe(false);
      expect(SpellEffectSchema.isAuraEffect(effect)).toBe(false);
    });

    it('should identify heal effects', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.HEAL,
        23: 200.0,
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.isHealEffect(effect)).toBe(true);
      expect(SpellEffectSchema.isDamageEffect(effect)).toBe(false);
    });

    it('should identify aura effects', () => {
      const mockRecord = new MockDB2Record({
        1: AuraType.PERIODIC_DAMAGE, // effectAura
        4: SpellEffectName.APPLY_AURA, // effect
        7: 3000, // effectAuraPeriod (3 seconds)
        23: 50.0, // effectBasePoints (50 per tick)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.isAuraEffect(effect)).toBe(true);
      expect(SpellEffectSchema.getAuraType(effect)).toBe(AuraType.PERIODIC_DAMAGE);
      expect(SpellEffectSchema.isPeriodicEffect(effect)).toBe(true);
    });

    it('should identify periodic effects', () => {
      const mockRecord = new MockDB2Record({
        7: 3000, // effectAuraPeriod (3 seconds)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.isPeriodicEffect(effect)).toBe(true);
    });

    it('should identify chain target effects', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.SCHOOL_DAMAGE,
        9: 0.3, // effectChainAmplitude (30% reduction per hop)
        10: 3, // effectChainTargets (max 3 targets)
        33: Targets.UNIT_TARGET_ENEMY,
        34: Targets.UNIT_NEARBY_ENEMY,
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.hasChainTargets(effect)).toBe(true);
      expect(effect.effectChainTargets).toBe(3);
      expect(effect.effectChainAmplitude).toBe(0.3);
    });

    it('should identify area targeting', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.SCHOOL_DAMAGE,
        27: 12, // effectRadiusIndex[0] (8 yard radius)
        33: Targets.DEST_CASTER, // implicitTarget[0]
        34: Targets.UNIT_DEST_AREA_ENEMY, // implicitTarget[1] (area around dest)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.hasAreaTargeting(effect)).toBe(true);
      expect(SpellEffectSchema.hasRadius(effect)).toBe(true);
    });

    it('should identify triggered spells', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.TRIGGER_SPELL,
        16: 54321, // effectTriggerSpell
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.triggersSpell(effect)).toBe(true);
      expect(effect.effectTriggerSpell).toBe(54321);
    });

    it('should identify item creation', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.CREATE_ITEM,
        11: 18562, // effectItemType (item ID)
        25: 1, // effectMiscValue[0] (item count)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.createsItem(effect)).toBe(true);
      expect(effect.effectItemType).toBe(18562);
    });

    it('should identify summon effects', () => {
      const mockRecord = new MockDB2Record({
        4: SpellEffectName.SUMMON,
        25: 416, // effectMiscValue[0] (creature entry)
        26: 1, // effectMiscValue[1] (summon type)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.summonsCreature(effect)).toBe(true);
      expect(effect.effectMiscValue[0]).toBe(416);
    });

    it('should check target requirements', () => {
      const mockRecord = new MockDB2Record({
        33: Targets.UNIT_TARGET_ENEMY, // implicitTarget[0]
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.requiresTarget(effect)).toBe(true);
      expect(SpellEffectSchema.getPrimaryTarget(effect)).toBe(Targets.UNIT_TARGET_ENEMY);
      expect(SpellEffectSchema.getSecondaryTarget(effect)).toBeNull();
    });

    it('should check effect attributes', () => {
      const mockRecord = new MockDB2Record({
        6: SpellEffectAttributes.IS_HARMFUL | SpellEffectAttributes.PLAYERS_ONLY,
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.hasAttribute(effect, SpellEffectAttributes.IS_HARMFUL)).toBe(true);
      expect(SpellEffectSchema.hasAttribute(effect, SpellEffectAttributes.PLAYERS_ONLY)).toBe(true);
      expect(SpellEffectSchema.hasAttribute(effect, SpellEffectAttributes.NO_IMMUNITY)).toBe(false);
      expect(SpellEffectSchema.isHarmful(effect)).toBe(true);
      expect(SpellEffectSchema.isPlayersOnly(effect)).toBe(true);
    });

    it('should calculate power coefficient', () => {
      const mockRecord = new MockDB2Record({
        8: 0.85, // effectBonusCoefficient (spell power)
        17: 0.15, // bonusCoefficientFromAP (attack power)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.getPowerCoefficient(effect)).toBe(1.0);
    });

    it('should get base value', () => {
      const mockRecord = new MockDB2Record({
        23: 150.0, // effectBasePoints
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(SpellEffectSchema.getBaseValue(effect)).toBe(150.0);
    });

    it('should calculate tick count', () => {
      const mockRecord = new MockDB2Record({
        7: 3000, // effectAuraPeriod (3 seconds)
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      // 18 second duration = 6 ticks at 3s intervals
      expect(SpellEffectSchema.getTickCount(effect, 18000)).toBe(6);

      // Non-periodic returns 0
      const nonPeriodicRecord = new MockDB2Record({ 7: 0 });
      const nonPeriodicEffect = SpellEffectSchema.parse(nonPeriodicRecord);
      expect(SpellEffectSchema.getTickCount(nonPeriodicEffect, 18000)).toBe(0);
    });

    it('should match spell class mask', () => {
      const mockRecord = new MockDB2Record({
        29: 0x00000001, // effectSpellClassMask[0]
        30: 0x00000002, // effectSpellClassMask[1]
        31: 0x00000004, // effectSpellClassMask[2]
        32: 0x00000008, // effectSpellClassMask[3]
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      // Test matching masks
      expect(SpellEffectSchema.matchesSpellClassMask(effect, [0x00000001, 0, 0, 0])).toBe(true);
      expect(SpellEffectSchema.matchesSpellClassMask(effect, [0, 0x00000002, 0, 0])).toBe(true);
      expect(SpellEffectSchema.matchesSpellClassMask(effect, [0, 0, 0, 0x00000008])).toBe(true);

      // Test non-matching mask
      expect(SpellEffectSchema.matchesSpellClassMask(effect, [0, 0, 0, 0])).toBe(false);
      expect(SpellEffectSchema.matchesSpellClassMask(effect, [0x00000010, 0, 0, 0])).toBe(false);
    });

    it('should get scaling class name', () => {
      const warriorRecord = new MockDB2Record({ 24: 1 });
      const allClassesRecord = new MockDB2Record({ 24: -1 });

      const warriorEffect = SpellEffectSchema.parse(warriorRecord);
      const allClassesEffect = SpellEffectSchema.parse(allClassesRecord);

      expect(SpellEffectSchema.getScalingClassName(warriorEffect)).toBe('Warrior');
      expect(SpellEffectSchema.getScalingClassName(allClassesEffect)).toBe('All Classes');
    });

    it('should generate effect description', () => {
      const damageRecord = new MockDB2Record({
        3: 0, // effectIndex
        4: SpellEffectName.SCHOOL_DAMAGE,
        7: 0, // not periodic
        10: 0, // no chain
        33: Targets.UNIT_TARGET_ENEMY,
      });

      const auraRecord = new MockDB2Record({
        1: AuraType.PERIODIC_DAMAGE,
        3: 1, // effectIndex
        4: SpellEffectName.APPLY_AURA,
        7: 3000, // periodic (3s)
        10: 0,
        33: Targets.UNIT_CASTER,
      });

      const chainRecord = new MockDB2Record({
        3: 2, // effectIndex
        4: SpellEffectName.SCHOOL_DAMAGE,
        7: 0,
        10: 3, // chain to 3 targets
        33: Targets.UNIT_TARGET_ENEMY,
      });

      const damageEffect = SpellEffectSchema.parse(damageRecord);
      const auraEffect = SpellEffectSchema.parse(auraRecord);
      const chainEffect = SpellEffectSchema.parse(chainRecord);

      const damageDesc = SpellEffectSchema.getEffectDescription(damageEffect);
      const auraDesc = SpellEffectSchema.getEffectDescription(auraEffect);
      const chainDesc = SpellEffectSchema.getEffectDescription(chainEffect);

      expect(damageDesc).toContain('Effect 0');
      expect(damageDesc).toContain('SCHOOL_DAMAGE');
      expect(damageDesc).toContain('UNIT_TARGET_ENEMY');

      expect(auraDesc).toContain('Effect 1');
      expect(auraDesc).toContain('APPLY_AURA');
      expect(auraDesc).toContain('Aura: PERIODIC_DAMAGE');
      expect(auraDesc).toContain('Periodic: 3000ms');

      expect(chainDesc).toContain('Effect 2');
      expect(chainDesc).toContain('Chain: 3 targets');
    });

    it('should parse all array fields correctly', () => {
      const mockRecord = new MockDB2Record({
        25: 100, // effectMiscValue[0]
        26: 200, // effectMiscValue[1]
        27: 10, // effectRadiusIndex[0]
        28: 20, // effectRadiusIndex[1]
        29: 0x1, // effectSpellClassMask[0]
        30: 0x2, // effectSpellClassMask[1]
        31: 0x4, // effectSpellClassMask[2]
        32: 0x8, // effectSpellClassMask[3]
        33: Targets.UNIT_TARGET_ENEMY, // implicitTarget[0]
        34: Targets.UNIT_NEARBY_ENEMY, // implicitTarget[1]
      });

      const effect = SpellEffectSchema.parse(mockRecord);

      expect(effect.effectMiscValue).toEqual([100, 200]);
      expect(effect.effectRadiusIndex).toEqual([10, 20]);
      expect(effect.effectSpellClassMask).toEqual([0x1, 0x2, 0x4, 0x8]);
      expect(effect.implicitTarget).toEqual([Targets.UNIT_TARGET_ENEMY, Targets.UNIT_NEARBY_ENEMY]);
    });
  });
});
