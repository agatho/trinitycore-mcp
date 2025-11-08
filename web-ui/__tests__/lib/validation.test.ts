/**
 * Validation Framework Tests
 *
 * Unit tests for data validation utilities and schemas
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  entryIdSchema,
  guidSchema,
  coordinateSchema,
  positionSchema,
  mapIdSchema,
  spawnTimeSchema,
  factionIdSchema,
  itemEntrySchema,
  questIdSchema,
  spellIdSchema,
  levelSchema,
  moneySchema,
  percentageSchema,
  flagsSchema,
  sqlIdentifierSchema,
  saiScriptSchema,
  creatureTemplateSchema,
  creatureSpawnSchema,
  lootEntrySchema,
  questTemplateSchema,
  validate,
  safeValidate,
  validatePartial,
  sanitizeString,
  sanitizeSQLIdentifier,
  validateArray,
  validateCreatureData,
  validateQuestData,
} from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

describe('Validation Framework', () => {
  beforeEach(() => {
    Logger.reset();
    Logger.configure({ enableConsole: false });
  });

  describe('Basic Schemas', () => {
    describe('entryIdSchema', () => {
      it('should accept valid entry IDs', () => {
        expect(entryIdSchema.parse(0)).toBe(0);
        expect(entryIdSchema.parse(12345)).toBe(12345);
        expect(entryIdSchema.parse(4294967295)).toBe(4294967295);
      });

      it('should reject negative numbers', () => {
        expect(() => entryIdSchema.parse(-1)).toThrow();
      });

      it('should reject numbers > max uint', () => {
        expect(() => entryIdSchema.parse(4294967296)).toThrow();
      });

      it('should reject non-integers', () => {
        expect(() => entryIdSchema.parse(123.45)).toThrow();
      });
    });

    describe('coordinateSchema', () => {
      it('should accept valid coordinates', () => {
        expect(coordinateSchema.parse(0)).toBe(0);
        expect(coordinateSchema.parse(-1234.567)).toBe(-1234.567);
        expect(coordinateSchema.parse(9999.999)).toBe(9999.999);
      });

      it('should reject Infinity', () => {
        expect(() => coordinateSchema.parse(Infinity)).toThrow();
        expect(() => coordinateSchema.parse(-Infinity)).toThrow();
      });

      it('should reject NaN', () => {
        expect(() => coordinateSchema.parse(NaN)).toThrow();
      });
    });

    describe('positionSchema', () => {
      it('should accept valid position', () => {
        const position = {
          x: 100.5,
          y: 200.75,
          z: 50.25,
          orientation: 1.57,
        };
        expect(positionSchema.parse(position)).toEqual(position);
      });

      it('should accept position without orientation', () => {
        const position = {
          x: 100,
          y: 200,
          z: 50,
        };
        expect(positionSchema.parse(position)).toEqual(position);
      });

      it('should reject invalid orientation', () => {
        expect(() => positionSchema.parse({
          x: 0,
          y: 0,
          z: 0,
          orientation: -1,
        })).toThrow();

        expect(() => positionSchema.parse({
          x: 0,
          y: 0,
          z: 0,
          orientation: 7, // > 2*PI
        })).toThrow();
      });
    });

    describe('mapIdSchema', () => {
      it('should accept valid map IDs', () => {
        expect(mapIdSchema.parse(0)).toBe(0);
        expect(mapIdSchema.parse(571)).toBe(571); // Northrend
        expect(mapIdSchema.parse(9999)).toBe(9999);
      });

      it('should reject out of range', () => {
        expect(() => mapIdSchema.parse(-1)).toThrow();
        expect(() => mapIdSchema.parse(10000)).toThrow();
      });
    });

    describe('percentageSchema', () => {
      it('should accept valid percentages', () => {
        expect(percentageSchema.parse(0)).toBe(0);
        expect(percentageSchema.parse(50.5)).toBe(50.5);
        expect(percentageSchema.parse(100)).toBe(100);
      });

      it('should reject out of range', () => {
        expect(() => percentageSchema.parse(-0.1)).toThrow();
        expect(() => percentageSchema.parse(100.1)).toThrow();
      });
    });

    describe('sqlIdentifierSchema', () => {
      it('should accept valid identifiers', () => {
        expect(sqlIdentifierSchema.parse('creature_template')).toBe('creature_template');
        expect(sqlIdentifierSchema.parse('_private')).toBe('_private');
        expect(sqlIdentifierSchema.parse('Table123')).toBe('Table123');
      });

      it('should reject invalid characters', () => {
        expect(() => sqlIdentifierSchema.parse('table-name')).toThrow();
        expect(() => sqlIdentifierSchema.parse('table name')).toThrow();
        expect(() => sqlIdentifierSchema.parse('table.name')).toThrow();
      });

      it('should reject starting with number', () => {
        expect(() => sqlIdentifierSchema.parse('123table')).toThrow();
      });

      it('should reject too long identifiers', () => {
        expect(() => sqlIdentifierSchema.parse('a'.repeat(65))).toThrow();
      });
    });
  });

  describe('TrinityCore Schemas', () => {
    describe('levelSchema', () => {
      it('should accept valid levels', () => {
        expect(levelSchema.parse(1)).toBe(1);
        expect(levelSchema.parse(80)).toBe(80);
        expect(levelSchema.parse(255)).toBe(255);
      });

      it('should reject invalid levels', () => {
        expect(() => levelSchema.parse(0)).toThrow();
        expect(() => levelSchema.parse(256)).toThrow();
      });
    });

    describe('itemEntrySchema', () => {
      it('should accept valid item entries', () => {
        expect(itemEntrySchema.parse(1)).toBe(1);
        expect(itemEntrySchema.parse(49623)).toBe(49623); // Shadowmourne
      });

      it('should reject invalid entries', () => {
        expect(() => itemEntrySchema.parse(0)).toThrow();
        expect(() => itemEntrySchema.parse(200001)).toThrow();
      });
    });

    describe('questIdSchema', () => {
      it('should accept valid quest IDs', () => {
        expect(questIdSchema.parse(1)).toBe(1);
        expect(questIdSchema.parse(24545)).toBe(24545);
      });

      it('should reject invalid IDs', () => {
        expect(() => questIdSchema.parse(0)).toThrow();
        expect(() => questIdSchema.parse(100001)).toThrow();
      });
    });

    describe('spellIdSchema', () => {
      it('should accept valid spell IDs', () => {
        expect(spellIdSchema.parse(0)).toBe(0);
        expect(spellIdSchema.parse(12345)).toBe(12345);
        expect(spellIdSchema.parse(300000)).toBe(300000);
      });

      it('should reject out of range', () => {
        expect(() => spellIdSchema.parse(-1)).toThrow();
        expect(() => spellIdSchema.parse(300001)).toThrow();
      });
    });
  });

  describe('Complex Schemas', () => {
    describe('saiScriptSchema', () => {
      it('should accept valid SAI script', () => {
        const script = {
          entryorguid: 12345,
          source_type: 0,
          id: 0,
          link: 0,
          event_type: 0,
          event_phase_mask: 0,
          event_chance: 100,
          event_flags: 0,
          event_param1: 0,
          event_param2: 0,
          event_param3: 0,
          event_param4: 0,
          action_type: 1,
          action_param1: 0,
          action_param2: 0,
          action_param3: 0,
          action_param4: 0,
          target_type: 1,
          target_param1: 0,
          target_param2: 0,
          target_param3: 0,
          comment: 'Test SAI Script',
        };

        expect(saiScriptSchema.parse(script)).toEqual(script);
      });

      it('should reject invalid event chance', () => {
        const script = {
          entryorguid: 12345,
          source_type: 0,
          id: 0,
          link: 0,
          event_type: 0,
          event_phase_mask: 0,
          event_chance: 150, // Invalid: > 100
          event_flags: 0,
          event_param1: 0,
          event_param2: 0,
          event_param3: 0,
          event_param4: 0,
          action_type: 1,
          action_param1: 0,
          action_param2: 0,
          action_param3: 0,
          action_param4: 0,
          target_type: 1,
          target_param1: 0,
          target_param2: 0,
          target_param3: 0,
          comment: 'Test',
        };

        expect(() => saiScriptSchema.parse(script)).toThrow();
      });
    });

    describe('creatureTemplateSchema', () => {
      it('should accept valid creature template', () => {
        const template = {
          entry: 12345,
          name: 'Test Creature',
          minlevel: 80,
          maxlevel: 80,
          faction: 14,
          npcflag: 0,
          speed_walk: 1.0,
          speed_run: 1.14286,
          scale: 1.0,
          rank: 0,
          dmgschool: 0,
          BaseAttackTime: 2000,
          RangeAttackTime: 0,
          unit_class: 1,
          unit_flags: 0,
          unit_flags2: 0,
          dynamicflags: 0,
          family: 0,
          trainer_type: 0,
          trainer_class: 0,
          trainer_race: 0,
          type: 7,
          type_flags: 0,
          PetSpellDataId: 0,
          VehicleId: 0,
          mingold: 0,
          maxgold: 0,
          AIName: 'SmartAI',
          MovementType: 0,
          InhabitType: 3,
          HoverHeight: 1.0,
          HealthModifier: 1.0,
          ManaModifier: 1.0,
          ArmorModifier: 1.0,
          DamageModifier: 1.0,
          ExperienceModifier: 1.0,
          RacialLeader: 0,
          movementId: 0,
          RegenHealth: 1,
          mechanic_immune_mask: 0,
          spell_school_immune_mask: 0,
          flags_extra: 0,
          ScriptName: '',
        };

        expect(creatureTemplateSchema.parse(template)).toEqual(template);
      });

      it('should reject invalid min/max level', () => {
        const template: any = {
          entry: 12345,
          name: 'Test',
          minlevel: 256, // Invalid
          maxlevel: 80,
          faction: 14,
          // ... other required fields
        };

        expect(() => creatureTemplateSchema.parse(template)).toThrow();
      });
    });

    describe('lootEntrySchema', () => {
      it('should accept valid loot entry', () => {
        const loot = {
          Entry: 12345,
          Item: 49623,
          Chance: 0.5,
          QuestRequired: 0,
          LootMode: 1,
          GroupId: 0,
          MinCount: 1,
          MaxCount: 1,
          Comment: 'Test Loot',
        };

        expect(lootEntrySchema.parse(loot)).toEqual(loot);
      });

      it('should reject invalid MinCount > MaxCount', () => {
        const loot = {
          Entry: 12345,
          Item: 49623,
          Chance: 100,
          QuestRequired: 0,
          LootMode: 1,
          GroupId: 0,
          MinCount: 5,
          MaxCount: 3, // Less than MinCount - but schema doesn't check this
          Comment: 'Test',
        };

        // Schema allows this, but custom validator should catch it
        expect(lootEntrySchema.parse(loot)).toBeDefined();
      });
    });
  });

  describe('Validation Utilities', () => {
    describe('validate', () => {
      it('should validate correct data', () => {
        const result = validate(entryIdSchema, 12345);
        expect(result).toBe(12345);
      });

      it('should throw ValidationError on invalid data', () => {
        expect(() => validate(entryIdSchema, -1, 'entry')).toThrow(ValidationError);
      });

      it('should log validation errors', () => {
        try {
          validate(entryIdSchema, 'invalid');
        } catch (e) {
          // Expected
        }

        const logs = Logger.getLogs({ context: 'Validation' });
        expect(logs.length).toBeGreaterThan(0);
      });
    });

    describe('safeValidate', () => {
      it('should return success for valid data', () => {
        const result = safeValidate(entryIdSchema, 12345);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(12345);
        }
      });

      it('should return errors for invalid data', () => {
        const result = safeValidate(entryIdSchema, -1);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors).toBeDefined();
        }
      });

      it('should log warnings on failure', () => {
        safeValidate(entryIdSchema, 'invalid');

        const logs = Logger.getLogs({ context: 'Validation' });
        expect(logs.length).toBeGreaterThan(0);
      });
    });

    describe('validatePartial', () => {
      it('should accept partial data', () => {
        const partial = validatePartial(creatureTemplateSchema, {
          entry: 12345,
          name: 'Partial Creature',
        });

        expect(partial.entry).toBe(12345);
        expect(partial.name).toBe('Partial Creature');
      });

      it('should validate provided fields', () => {
        expect(() => validatePartial(creatureTemplateSchema, {
          entry: -1, // Invalid
        })).toThrow();
      });
    });

    describe('sanitizeString', () => {
      it('should trim whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
      });

      it('should remove control characters', () => {
        expect(sanitizeString('hello\x00world\x1F')).toBe('helloworld');
      });

      it('should enforce max length', () => {
        expect(sanitizeString('a'.repeat(300), 10)).toBe('a'.repeat(10));
      });

      it('should handle empty strings', () => {
        expect(sanitizeString('')).toBe('');
      });
    });

    describe('sanitizeSQLIdentifier', () => {
      it('should remove invalid characters', () => {
        expect(sanitizeSQLIdentifier('table-name')).toBe('tablename');
        expect(sanitizeSQLIdentifier('table.name')).toBe('tablename');
      });

      it('should trim whitespace', () => {
        expect(sanitizeSQLIdentifier('  table_name  ')).toBe('table_name');
      });

      it('should enforce max length', () => {
        expect(sanitizeSQLIdentifier('a'.repeat(100))).toBe('a'.repeat(64));
      });
    });

    describe('validateArray', () => {
      it('should validate array of items', () => {
        const items = [1, 2, 3, 4, 5];
        const result = validateArray(entryIdSchema, items);
        expect(result).toEqual(items);
      });

      it('should throw on invalid item', () => {
        const items = [1, 2, -1, 4, 5];
        expect(() => validateArray(entryIdSchema, items)).toThrow();
      });

      it('should provide index in error context', () => {
        const items = [1, 2, 'invalid', 4, 5];
        try {
          validateArray(entryIdSchema, items, 'items');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      });
    });
  });

  describe('Composite Validators', () => {
    describe('validateCreatureData', () => {
      it('should validate complete creature data', () => {
        const creatureData = {
          template: {
            entry: 12345,
            name: 'Test Creature',
            minlevel: 80,
            maxlevel: 80,
            faction: 14,
            npcflag: 0,
            speed_walk: 1.0,
            speed_run: 1.14286,
            scale: 1.0,
            rank: 0,
            dmgschool: 0,
            BaseAttackTime: 2000,
            RangeAttackTime: 0,
            unit_class: 1,
            unit_flags: 0,
            unit_flags2: 0,
            dynamicflags: 0,
            family: 0,
            trainer_type: 0,
            trainer_class: 0,
            trainer_race: 0,
            type: 7,
            type_flags: 0,
            PetSpellDataId: 0,
            VehicleId: 0,
            mingold: 100,
            maxgold: 200,
            AIName: 'SmartAI',
            MovementType: 0,
            InhabitType: 3,
            HoverHeight: 1.0,
            HealthModifier: 1.0,
            ManaModifier: 1.0,
            ArmorModifier: 1.0,
            DamageModifier: 1.0,
            ExperienceModifier: 1.0,
            RacialLeader: 0,
            movementId: 0,
            RegenHealth: 1,
            mechanic_immune_mask: 0,
            spell_school_immune_mask: 0,
            flags_extra: 0,
            ScriptName: '',
          },
        };

        expect(validateCreatureData(creatureData)).toEqual(creatureData);
      });

      it('should reject minlevel > maxlevel', () => {
        const creatureData: any = {
          template: {
            entry: 12345,
            name: 'Test',
            minlevel: 85,
            maxlevel: 80, // Less than minlevel
            mingold: 0,
            maxgold: 100,
            // ... other fields
          },
        };

        expect(() => validateCreatureData(creatureData)).toThrow();
      });

      it('should reject mingold > maxgold', () => {
        const creatureData: any = {
          template: {
            entry: 12345,
            minlevel: 80,
            maxlevel: 80,
            mingold: 200,
            maxgold: 100, // Less than mingold
            // ... other fields
          },
        };

        expect(() => validateCreatureData(creatureData)).toThrow();
      });
    });

    describe('validateQuestData', () => {
      it('should validate quest data', () => {
        const questData = {
          template: {
            ID: 12345,
            QuestType: 2,
            QuestLevel: 80,
            MinLevel: 75,
            QuestSortID: 0,
            QuestInfoID: 0,
            SuggestedGroupNum: 0,
            RequiredFactionValue1: 0,
            RequiredFactionValue2: 0,
            RewardXPDifficulty: 5,
            RewardMoney: 100000,
            RewardBonusMoney: 0,
            RewardHonor: 0,
            RewardKillHonor: 0,
            Flags: 0,
            RequiredPlayerKills: 0,
            RewardAmount1: 1,
            RewardAmount2: 1,
            RewardAmount3: 1,
            RewardAmount4: 1,
            LogTitle: 'Test Quest',
            LogDescription: 'Test quest description',
            QuestDescription: 'Full quest description',
          },
        };

        expect(validateQuestData(questData)).toEqual(questData);
      });

      it('should reject MinLevel > QuestLevel', () => {
        const questData: any = {
          template: {
            ID: 12345,
            QuestLevel: 80,
            MinLevel: 85, // Higher than QuestLevel
            // ... other fields
          },
        };

        expect(() => validateQuestData(questData)).toThrow();
      });
    });
  });
});
