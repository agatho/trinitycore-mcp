/**
 * Data Validation Framework
 *
 * Comprehensive validation utilities using Zod with custom validators
 * for TrinityCore-specific data types and patterns.
 *
 * @module validation
 */

import { z } from 'zod';
import { ValidationError } from './errors';
import { Logger } from './logger';

// ============================================================================
// Common Validators
// ============================================================================

/**
 * TrinityCore Entry ID (unsigned int)
 */
export const entryIdSchema = z.number()
  .int()
  .min(0)
  .max(4294967295)
  .describe('Entry ID must be a valid unsigned integer (0-4294967295)');

/**
 * GUID (unsigned bigint)
 */
export const guidSchema = z.number()
  .int()
  .min(0)
  .describe('GUID must be a non-negative integer');

/**
 * Coordinates (float)
 */
export const coordinateSchema = z.number()
  .finite()
  .describe('Coordinate must be a finite number');

/**
 * Position (x, y, z, orientation)
 */
export const positionSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  z: coordinateSchema,
  orientation: z.number().min(0).max(2 * Math.PI).optional(),
});

/**
 * Map ID
 */
export const mapIdSchema = z.number()
  .int()
  .min(0)
  .max(9999)
  .describe('Map ID must be between 0 and 9999');

/**
 * Phase ID
 */
export const phaseIdSchema = z.number()
  .int()
  .min(0)
  .describe('Phase ID must be non-negative');

/**
 * Spawn time (seconds)
 */
export const spawnTimeSchema = z.number()
  .int()
  .min(0)
  .max(604800) // Max 1 week
  .describe('Spawn time must be between 0 and 604800 seconds');

/**
 * Faction ID
 */
export const factionIdSchema = z.number()
  .int()
  .min(0)
  .max(65535)
  .describe('Faction ID must be between 0 and 65535');

/**
 * Item Entry
 */
export const itemEntrySchema = z.number()
  .int()
  .min(1)
  .max(200000)
  .describe('Item entry must be between 1 and 200000');

/**
 * Quest ID
 */
export const questIdSchema = z.number()
  .int()
  .min(1)
  .max(100000)
  .describe('Quest ID must be between 1 and 100000');

/**
 * Spell ID
 */
export const spellIdSchema = z.number()
  .int()
  .min(0)
  .max(300000)
  .describe('Spell ID must be between 0 and 300000');

/**
 * NPC Text ID
 */
export const npcTextIdSchema = z.number()
  .int()
  .min(0)
  .describe('NPC Text ID must be non-negative');

/**
 * Gossip Menu ID
 */
export const gossipMenuIdSchema = z.number()
  .int()
  .min(0)
  .describe('Gossip Menu ID must be non-negative');

/**
 * Creature display ID
 */
export const displayIdSchema = z.number()
  .int()
  .min(0)
  .max(100000)
  .describe('Display ID must be between 0 and 100000');

/**
 * Level (1-255)
 */
export const levelSchema = z.number()
  .int()
  .min(1)
  .max(255)
  .describe('Level must be between 1 and 255');

/**
 * Money (copper)
 */
export const moneySchema = z.number()
  .int()
  .min(0)
  .describe('Money must be non-negative');

/**
 * Percentage (0-100)
 */
export const percentageSchema = z.number()
  .min(0)
  .max(100)
  .describe('Percentage must be between 0 and 100');

/**
 * Flags (bitmask)
 */
export const flagsSchema = z.number()
  .int()
  .min(0)
  .describe('Flags must be a non-negative integer');

/**
 * SQL identifier (table/column name)
 */
export const sqlIdentifierSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  .max(64)
  .describe('SQL identifier must be alphanumeric with underscores, max 64 chars');

/**
 * Localized string
 */
export const localizedStringSchema = z.object({
  text_loc1: z.string().optional(), // Korean
  text_loc2: z.string().optional(), // French
  text_loc3: z.string().optional(), // German
  text_loc4: z.string().optional(), // Chinese
  text_loc5: z.string().optional(), // Taiwanese
  text_loc6: z.string().optional(), // Spanish (Spain)
  text_loc7: z.string().optional(), // Spanish (Latin America)
  text_loc8: z.string().optional(), // Russian
});

// ============================================================================
// SmartAI Validators
// ============================================================================

/**
 * SmartAI Event Type
 */
export const saiEventTypeSchema = z.number()
  .int()
  .min(0)
  .max(100)
  .describe('SAI Event Type must be between 0 and 100');

/**
 * SmartAI Action Type
 */
export const saiActionTypeSchema = z.number()
  .int()
  .min(0)
  .max(200)
  .describe('SAI Action Type must be between 0 and 200');

/**
 * SmartAI Target Type
 */
export const saiTargetTypeSchema = z.number()
  .int()
  .min(0)
  .max(50)
  .describe('SAI Target Type must be between 0 and 50');

/**
 * SmartAI Script Entry
 */
export const saiScriptSchema = z.object({
  entryorguid: z.number().int(),
  source_type: z.number().int().min(0).max(9),
  id: z.number().int().min(0),
  link: z.number().int().min(0),
  event_type: saiEventTypeSchema,
  event_phase_mask: z.number().int().min(0),
  event_chance: percentageSchema,
  event_flags: flagsSchema,
  event_param1: z.number().int(),
  event_param2: z.number().int(),
  event_param3: z.number().int(),
  event_param4: z.number().int(),
  event_param5: z.number().int().optional(),
  action_type: saiActionTypeSchema,
  action_param1: z.number().int(),
  action_param2: z.number().int(),
  action_param3: z.number().int(),
  action_param4: z.number().int(),
  action_param5: z.number().int().optional(),
  action_param6: z.number().int().optional(),
  target_type: saiTargetTypeSchema,
  target_param1: z.number().int(),
  target_param2: z.number().int(),
  target_param3: z.number().int(),
  target_param4: z.number().int().optional(),
  target_x: coordinateSchema.optional(),
  target_y: coordinateSchema.optional(),
  target_z: coordinateSchema.optional(),
  target_o: z.number().optional(),
  comment: z.string().max(255),
});

// ============================================================================
// Creature/GameObject Validators
// ============================================================================

/**
 * Creature Template
 */
export const creatureTemplateSchema = z.object({
  entry: entryIdSchema,
  name: z.string().min(1).max(100),
  subname: z.string().max(100).optional(),
  minlevel: levelSchema,
  maxlevel: levelSchema,
  faction: factionIdSchema,
  npcflag: flagsSchema,
  speed_walk: z.number().min(0).max(10),
  speed_run: z.number().min(0).max(20),
  scale: z.number().min(0.1).max(10),
  rank: z.number().int().min(0).max(4),
  dmgschool: z.number().int().min(0).max(6),
  BaseAttackTime: z.number().int().min(0).max(10000),
  RangeAttackTime: z.number().int().min(0).max(10000),
  unit_class: z.number().int().min(1).max(4),
  unit_flags: flagsSchema,
  unit_flags2: flagsSchema,
  dynamicflags: flagsSchema,
  family: z.number().int().min(0).max(50),
  trainer_type: z.number().int().min(0).max(3),
  trainer_spell: spellIdSchema.optional(),
  trainer_class: z.number().int().min(0).max(11),
  trainer_race: z.number().int().min(0).max(20),
  type: z.number().int().min(0).max(10),
  type_flags: flagsSchema,
  lootid: entryIdSchema.optional(),
  pickpocketloot: entryIdSchema.optional(),
  skinloot: entryIdSchema.optional(),
  PetSpellDataId: z.number().int().min(0),
  VehicleId: z.number().int().min(0),
  mingold: moneySchema,
  maxgold: moneySchema,
  AIName: z.string().max(64),
  MovementType: z.number().int().min(0).max(2),
  InhabitType: z.number().int().min(0).max(7),
  HoverHeight: z.number(),
  HealthModifier: z.number().min(0),
  ManaModifier: z.number().min(0),
  ArmorModifier: z.number().min(0),
  DamageModifier: z.number().min(0),
  ExperienceModifier: z.number().min(0),
  RacialLeader: z.boolean().or(z.number().int().min(0).max(1)),
  movementId: z.number().int().min(0),
  RegenHealth: z.boolean().or(z.number().int().min(0).max(1)),
  mechanic_immune_mask: flagsSchema,
  spell_school_immune_mask: flagsSchema,
  flags_extra: flagsSchema,
  ScriptName: z.string().max(64),
});

/**
 * Creature Spawn
 */
export const creatureSpawnSchema = z.object({
  guid: guidSchema,
  id: entryIdSchema,
  map: mapIdSchema,
  zoneId: z.number().int().min(0),
  areaId: z.number().int().min(0),
  spawnMask: z.number().int().min(0),
  phaseMask: z.number().int().min(0),
  modelid: displayIdSchema.optional(),
  equipment_id: z.number().int().min(-1),
  position_x: coordinateSchema,
  position_y: coordinateSchema,
  position_z: coordinateSchema,
  orientation: z.number().min(0).max(2 * Math.PI),
  spawntimesecs: spawnTimeSchema,
  wander_distance: z.number().min(0).max(100),
  currentwaypoint: z.number().int().min(0),
  curhealth: z.number().int().min(1),
  curmana: z.number().int().min(0),
  MovementType: z.number().int().min(0).max(2),
  npcflag: flagsSchema,
  unit_flags: flagsSchema,
  dynamicflags: flagsSchema,
});

// ============================================================================
// Loot Validators
// ============================================================================

/**
 * Loot Entry
 */
export const lootEntrySchema = z.object({
  Entry: entryIdSchema,
  Item: itemEntrySchema,
  Reference: entryIdSchema.optional(),
  Chance: percentageSchema,
  QuestRequired: z.boolean().or(z.number().int().min(0).max(1)),
  LootMode: z.number().int().min(0),
  GroupId: z.number().int().min(0),
  MinCount: z.number().int().min(1).max(255),
  MaxCount: z.number().int().min(1).max(255),
  Comment: z.string().max(255).optional(),
});

// ============================================================================
// Quest Validators
// ============================================================================

/**
 * Quest Template
 */
export const questTemplateSchema = z.object({
  ID: questIdSchema,
  QuestType: z.number().int().min(0).max(3),
  QuestLevel: z.number().int().min(-1).max(255),
  MinLevel: levelSchema,
  QuestSortID: z.number().int(),
  QuestInfoID: z.number().int(),
  SuggestedGroupNum: z.number().int().min(0).max(5),
  RequiredFactionId1: factionIdSchema.optional(),
  RequiredFactionId2: factionIdSchema.optional(),
  RequiredFactionValue1: z.number().int(),
  RequiredFactionValue2: z.number().int(),
  RewardNextQuest: questIdSchema.optional(),
  RewardXPDifficulty: z.number().int().min(0).max(10),
  RewardMoney: moneySchema,
  RewardBonusMoney: moneySchema,
  RewardDisplaySpell: spellIdSchema.optional(),
  RewardSpell: spellIdSchema.optional(),
  RewardHonor: z.number().int(),
  RewardKillHonor: z.number().int(),
  StartItem: itemEntrySchema.optional(),
  Flags: flagsSchema,
  RequiredPlayerKills: z.number().int().min(0),
  RewardItem1: itemEntrySchema.optional(),
  RewardAmount1: z.number().int().min(0).max(255),
  RewardItem2: itemEntrySchema.optional(),
  RewardAmount2: z.number().int().min(0).max(255),
  RewardItem3: itemEntrySchema.optional(),
  RewardAmount3: z.number().int().min(0).max(255),
  RewardItem4: itemEntrySchema.optional(),
  RewardAmount4: z.number().int().min(0).max(255),
  LogTitle: z.string().max(255),
  LogDescription: z.string(),
  QuestDescription: z.string(),
  AreaDescription: z.string().optional(),
  QuestCompletionLog: z.string().optional(),
});

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate data against schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'data'
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      Logger.error('Validation', error, { context, data });

      throw new ValidationError(
        firstError.path.join('.') || context,
        data,
        firstError.message
      );
    }
    throw error;
  }
}

/**
 * Safely validate data (returns result object)
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    Logger.warn('Validation', 'Validation failed', { errors: result.error.errors });
    return { success: false, errors: result.error };
  }
}

/**
 * Validate partial data (all fields optional)
 */
export function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'data'
): Partial<T> {
  const partialSchema = schema.partial();
  return validate(partialSchema, data, context);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, maxLength);
}

/**
 * Sanitize SQL identifier
 */
export function sanitizeSQLIdentifier(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '')
    .substring(0, 64);
}

/**
 * Validate array of items
 */
export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  context: string = 'array'
): T[] {
  return data.map((item, index) =>
    validate(schema, item, `${context}[${index}]`)
  );
}

/**
 * Create custom validator
 */
export function createValidator<T>(
  schema: z.ZodSchema<T>,
  customValidations?: (data: T) => string | null
) {
  return (data: unknown, context: string = 'data'): T => {
    const validated = validate(schema, data, context);

    if (customValidations) {
      const error = customValidations(validated);
      if (error) {
        throw new ValidationError(context, data, error);
      }
    }

    return validated;
  };
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Validate creature with all related data
 */
export const validateCreatureData = createValidator(
  z.object({
    template: creatureTemplateSchema,
    spawns: z.array(creatureSpawnSchema).optional(),
    loot: z.array(lootEntrySchema).optional(),
    sai: z.array(saiScriptSchema).optional(),
  }),
  (data) => {
    // Custom validation: spawns must reference valid template
    if (data.spawns) {
      for (const spawn of data.spawns) {
        if (spawn.id !== data.template.entry) {
          return `Spawn ID ${spawn.id} does not match template entry ${data.template.entry}`;
        }
      }
    }

    // Custom validation: min level <= max level
    if (data.template.minlevel > data.template.maxlevel) {
      return `Min level (${data.template.minlevel}) cannot exceed max level (${data.template.maxlevel})`;
    }

    // Custom validation: min gold <= max gold
    if (data.template.mingold > data.template.maxgold) {
      return `Min gold (${data.template.mingold}) cannot exceed max gold (${data.template.maxgold})`;
    }

    return null;
  }
);

/**
 * Validate quest with objectives
 */
export const validateQuestData = createValidator(
  z.object({
    template: questTemplateSchema,
    objectives: z.array(z.object({
      type: z.number().int().min(0).max(10),
      objectId: z.number().int().min(0),
      amount: z.number().int().min(1).max(255),
    })).optional(),
  }),
  (data) => {
    // Custom validation: MinLevel <= QuestLevel
    if (data.template.QuestLevel > 0 && data.template.MinLevel > data.template.QuestLevel) {
      return `Min level (${data.template.MinLevel}) cannot exceed quest level (${data.template.QuestLevel})`;
    }

    return null;
  }
);
