/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This file is DEPRECATED and will be removed in a future version.
 *
 * Please migrate to the new unified SAI editor:
 * - Location: @/lib/sai-unified/
 * - Components: @/components/sai-editor/
 * - Documentation: /docs/SAI_EDITOR_USER_GUIDE.md
 * - Migration Guide: Run `npx ts-node scripts/migrate-sai-editor.ts`
 *
 * New features in unified editor:
 * - AI-powered generation (GPT-4, Claude, Ollama, LM Studio)
 * - Real-time database validation
 * - Collaborative editing
 * - 12+ pre-built templates
 * - Performance optimizations
 * - Comprehensive testing
 *
 * @deprecated Use @/lib/sai-unified/ instead
 * @see /docs/SAI_EDITOR_USER_GUIDE.md
 */

/**
 * Smart AI (SAI) Editor Utilities
 *
 * Provides utilities for visual SAI script building and SQL generation.
 */

export interface SAIEvent {
  id: string;
  type: string;
  typeName: string;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  param5?: number;
  description: string;
}

export interface SAIAction {
  id: string;
  type: string;
  typeName: string;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  param5?: number;
  param6?: number;
  description: string;
}

export interface SAITarget {
  id: string;
  type: string;
  typeName: string;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  description: string;
}

export interface SAIScript {
  id: string;
  entryOrGuid: number;
  sourceType: number;
  eventType: number;
  eventPhaseMask: number;
  eventChance: number;
  eventFlags: number;
  event: SAIEvent;
  actions: SAIAction[];
  target: SAITarget;
  comment: string;
}

/**
 * SAI Event Types
 */
export const SAI_EVENT_TYPES = [
  { id: '0', name: 'UPDATE_IC', label: 'Update In Combat', params: ['InitialMin', 'InitialMax', 'RepeatMin', 'RepeatMax'] },
  { id: '1', name: 'UPDATE_OOC', label: 'Update Out of Combat', params: ['InitialMin', 'InitialMax', 'RepeatMin', 'RepeatMax'] },
  { id: '2', name: 'HEALTH_PCT', label: 'Health Percentage', params: ['HPMin%', 'HPMax%', 'RepeatMin', 'RepeatMax'] },
  { id: '3', name: 'MANA_PCT', label: 'Mana Percentage', params: ['ManaMin%', 'ManaMax%', 'RepeatMin', 'RepeatMax'] },
  { id: '4', name: 'AGGRO', label: 'On Aggro', params: [] },
  { id: '5', name: 'KILL', label: 'On Kill', params: ['CooldownMin', 'CooldownMax'] },
  { id: '6', name: 'DEATH', label: 'On Death', params: [] },
  { id: '7', name: 'EVADE', label: 'On Evade', params: [] },
  { id: '8', name: 'SPELLHIT', label: 'On Spell Hit', params: ['SpellID', 'School', 'CooldownMin', 'CooldownMax'] },
  { id: '9', name: 'RANGE', label: 'On Range', params: ['MinDist', 'MaxDist', 'RepeatMin', 'RepeatMax'] },
  { id: '10', name: 'OOC_LOS', label: 'OOC Line of Sight', params: ['HostileCrew', 'MaxRange', 'CooldownMin', 'CooldownMax'] },
  { id: '11', name: 'RESPAWN', label: 'On Respawn', params: [] },
  { id: '25', name: 'RESET', label: 'On Reset', params: [] },
  { id: '26', name: 'IC_LOS', label: 'IC Line of Sight', params: ['HostileCrew', 'MaxRange', 'CooldownMin', 'CooldownMax'] },
  { id: '54', name: 'JUST_SUMMONED', label: 'On Just Summoned', params: [] },
  { id: '60', name: 'UPDATE', label: 'Update (Always)', params: ['InitialMin', 'InitialMax', 'RepeatMin', 'RepeatMax'] },
];

/**
 * SAI Action Types
 */
export const SAI_ACTION_TYPES = [
  { id: '1', name: 'TALK', label: 'Say Text', params: ['TextID', 'Duration', 'UseTalkTarget'] },
  { id: '2', name: 'SET_FACTION', label: 'Set Faction', params: ['FactionID'] },
  { id: '3', name: 'MORPH_TO_ENTRY_OR_MODEL', label: 'Morph', params: ['CreatureEntry', 'ModelID'] },
  { id: '5', name: 'FAIL_QUEST', label: 'Fail Quest', params: ['QuestID'] },
  { id: '11', name: 'CAST', label: 'Cast Spell', params: ['SpellID', 'CastFlags', 'TriggerFlags'] },
  { id: '12', name: 'SUMMON_CREATURE', label: 'Summon Creature', params: ['CreatureEntry', 'SummonType', 'Duration', 'AttackInvoker'] },
  { id: '14', name: 'FLEE_FOR_ASSIST', label: 'Flee for Assist', params: [] },
  { id: '15', name: 'CALL_FOR_HELP', label: 'Call for Help', params: ['Radius'] },
  { id: '17', name: 'SET_EMOTE_STATE', label: 'Set Emote State', params: ['EmoteID'] },
  { id: '18', name: 'SET_UNIT_FLAG', label: 'Set Unit Flag', params: ['Flags'] },
  { id: '19', name: 'REMOVE_UNIT_FLAG', label: 'Remove Unit Flag', params: ['Flags'] },
  { id: '20', name: 'AUTO_ATTACK', label: 'Auto Attack', params: ['AllowAttackState'] },
  { id: '22', name: 'COMBAT_MOVEMENT', label: 'Combat Movement', params: ['AllowMovement'] },
  { id: '28', name: 'SET_REACT_STATE', label: 'Set React State', params: ['State'] },
  { id: '37', name: 'DIE', label: 'Force Die', params: [] },
  { id: '41', name: 'INVOKER_CAST', label: 'Invoker Cast', params: ['SpellID', 'CastFlags'] },
  { id: '49', name: 'MOVE_TO_POS', label: 'Move to Position', params: ['X', 'Y', 'Z', 'O'] },
  { id: '51', name: 'ADD_AURA', label: 'Add Aura', params: ['SpellID'] },
  { id: '75', name: 'FOLLOW', label: 'Follow', params: ['Distance', 'Angle', 'EndCreatureEntry'] },
  { id: '80', name: 'SET_DATA', label: 'Set Data', params: ['Field', 'Data'] },
];

/**
 * SAI Target Types
 */
export const SAI_TARGET_TYPES = [
  { id: '0', name: 'NONE', label: 'No Target', params: [] },
  { id: '1', name: 'SELF', label: 'Self', params: [] },
  { id: '2', name: 'VICTIM', label: 'Current Victim', params: [] },
  { id: '3', name: 'HOSTILE_SECOND_AGGRO', label: 'Second Aggro', params: [] },
  { id: '4', name: 'HOSTILE_LAST_AGGRO', label: 'Last Aggro', params: [] },
  { id: '5', name: 'HOSTILE_RANDOM', label: 'Random Target', params: ['MaxDist'] },
  { id: '6', name: 'HOSTILE_RANDOM_NOT_TOP', label: 'Random Not Top', params: ['MaxDist'] },
  { id: '7', name: 'ACTION_INVOKER', label: 'Action Invoker', params: [] },
  { id: '9', name: 'CREATURE_RANGE', label: 'Creature in Range', params: ['CreatureEntry', 'MinDist', 'MaxDist'] },
  { id: '10', name: 'CREATURE_GUID', label: 'Creature by GUID', params: ['GUID', 'Entry'] },
  { id: '12', name: 'STORED', label: 'Stored Target', params: ['ID'] },
  { id: '16', name: 'CLOSEST_CREATURE', label: 'Closest Creature', params: ['CreatureEntry', 'MaxDist', 'Alive'] },
  { id: '17', name: 'CLOSEST_PLAYER', label: 'Closest Player', params: ['MaxDist'] },
  { id: '18', name: 'ACTION_INVOKER_VEHICLE', label: 'Invoker Vehicle', params: [] },
  { id: '19', name: 'OWNER_OR_SUMMONER', label: 'Owner or Summoner', params: [] },
  { id: '21', name: 'CLOSEST_ENEMY', label: 'Closest Enemy', params: ['MaxDist', 'PlayerOnly'] },
];

/**
 * Generate SQL for SAI script
 */
export function generateSAISQL(script: SAIScript): string {
  const actions = script.actions.map((action, index) => {
    return `(${script.entryOrGuid}, ${script.sourceType}, ${index}, 0, ` +
      `${script.eventType}, ${script.eventPhaseMask}, ${script.eventChance}, ${script.eventFlags}, ` +
      `${script.event.param1 || 0}, ${script.event.param2 || 0}, ${script.event.param3 || 0}, ${script.event.param4 || 0}, ${script.event.param5 || 0}, ` +
      `${action.type}, ${action.param1 || 0}, ${action.param2 || 0}, ${action.param3 || 0}, ${action.param4 || 0}, ${action.param5 || 0}, ${action.param6 || 0}, ` +
      `${script.target.type}, ${script.target.param1 || 0}, ${script.target.param2 || 0}, ${script.target.param3 || 0}, ${script.target.param4 || 0}, ` +
      `0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '${script.comment}')`;
  }).join(',\n');

  return `-- SAI Script: ${script.comment}
DELETE FROM smart_scripts WHERE entryorguid = ${script.entryOrGuid} AND source_type = ${script.sourceType};
INSERT INTO smart_scripts (entryorguid, source_type, id, link, event_type, event_phase_mask, event_chance, event_flags,
  event_param1, event_param2, event_param3, event_param4, event_param5,
  action_type, action_param1, action_param2, action_param3, action_param4, action_param5, action_param6,
  target_type, target_param1, target_param2, target_param3, target_param4,
  target_x, target_y, target_z, target_o,
  raw_param1, raw_param2, raw_param3, raw_param4, raw_param5, raw_param6, raw_param7, raw_param8,
  comment) VALUES
${actions};`;
}

/**
 * SAI Script Templates
 */
export const SAI_TEMPLATES = [
  {
    id: 'basic-combat',
    name: 'Basic Combat',
    description: 'Simple combat AI with spell casting',
    script: {
      eventType: 0, // UPDATE_IC
      event: { type: '0', typeName: 'UPDATE_IC', param1: 5000, param2: 8000, param3: 12000, param4: 15000, description: 'Every 12-15s after 5-8s initial' },
      actions: [
        { type: '11', typeName: 'CAST', param1: 9613, description: 'Cast Shadow Bolt' }
      ],
      target: { type: '2', typeName: 'VICTIM', description: 'Current victim' },
    }
  },
  {
    id: 'health-based',
    name: 'Health-Based Action',
    description: 'Execute action at low health',
    script: {
      eventType: 2, // HEALTH_PCT
      event: { type: '2', typeName: 'HEALTH_PCT', param1: 20, param2: 20, param3: 0, param4: 0, description: 'At 20% health' },
      actions: [
        { type: '1', typeName: 'TALK', param1: 0, description: 'Yell for help' },
        { type: '15', typeName: 'CALL_FOR_HELP', param1: 30, description: 'Call allies within 30y' }
      ],
      target: { type: '1', typeName: 'SELF', description: 'Self' },
    }
  },
  {
    id: 'on-aggro',
    name: 'On Aggro',
    description: 'Actions when entering combat',
    script: {
      eventType: 4, // AGGRO
      event: { type: '4', typeName: 'AGGRO', description: 'On aggro' },
      actions: [
        { type: '1', typeName: 'TALK', param1: 0, description: 'Yell aggro text' },
        { type: '20', typeName: 'AUTO_ATTACK', param1: 1, description: 'Enable melee' }
      ],
      target: { type: '1', typeName: 'SELF', description: 'Self' },
    }
  },
  {
    id: 'on-death',
    name: 'On Death',
    description: 'Actions when creature dies',
    script: {
      eventType: 6, // DEATH
      event: { type: '6', typeName: 'DEATH', description: 'On death' },
      actions: [
        { type: '1', typeName: 'TALK', param1: 0, description: 'Yell death text' },
        { type: '12', typeName: 'SUMMON_CREATURE', param1: 1234, param2: 6, param3: 60000, description: 'Summon adds' }
      ],
      target: { type: '1', typeName: 'SELF', description: 'Self' },
    }
  },
  {
    id: 'patrol',
    name: 'Patrol Route',
    description: 'NPC follows waypoint path',
    script: {
      eventType: 11, // RESPAWN
      event: { type: '11', typeName: 'RESPAWN', description: 'On respawn' },
      actions: [
        { type: '80', typeName: 'SET_DATA', param1: 0, param2: 1, description: 'Start waypoint movement' }
      ],
      target: { type: '1', typeName: 'SELF', description: 'Self' },
    }
  },
];

/**
 * Validate SAI script
 */
export function validateSAIScript(script: SAIScript): string[] {
  const errors: string[] = [];

  if (!script.entryOrGuid) {
    errors.push('Entry or GUID is required');
  }

  if (!script.event) {
    errors.push('Event is required');
  }

  if (!script.actions || script.actions.length === 0) {
    errors.push('At least one action is required');
  }

  if (!script.target) {
    errors.push('Target is required');
  }

  // Validate event parameters
  const eventType = SAI_EVENT_TYPES.find(e => e.id === script.event.type);
  if (eventType) {
    if (eventType.params.length > 0 && !script.event.param1) {
      errors.push(`Event ${eventType.label} requires parameter: ${eventType.params[0]}`);
    }
  }

  return errors;
}

/**
 * Format SAI script as human-readable text
 */
export function formatSAIScript(script: SAIScript): string {
  let text = `SAI Script: ${script.comment}\n\n`;
  text += `Entry/GUID: ${script.entryOrGuid}\n`;
  text += `Source Type: ${script.sourceType}\n\n`;

  text += `EVENT: ${script.event.typeName}\n`;
  text += `  ${script.event.description}\n\n`;

  text += `ACTIONS:\n`;
  script.actions.forEach((action, i) => {
    text += `  ${i + 1}. ${action.typeName}: ${action.description}\n`;
  });

  text += `\nTARGET: ${script.target.typeName}\n`;
  text += `  ${script.target.description}\n`;

  return text;
}
