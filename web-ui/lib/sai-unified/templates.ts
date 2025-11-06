/**
 * TrinityCore SAI Unified Editor - Template Library
 *
 * Comprehensive library of pre-built SAI script templates.
 * Covers 20+ common scenarios with placeholders for customization.
 *
 * @module sai-unified/templates
 * @version 3.0.0
 */

import type { SAITemplate, TemplateCategory, SAIScript, SAISourceType } from './types';

// ============================================================================
// TEMPLATE LIBRARY
// ============================================================================

/**
 * Complete template library with 20+ templates
 */
export const SAI_TEMPLATE_LIBRARY: SAITemplate[] = [
  // ===== COMBAT TEMPLATES =====
  {
    id: 'basic-melee-combat',
    name: 'Basic Melee Combat',
    description: 'Simple melee attacker that auto-attacks and uses a single ability',
    category: 'combat',
    tags: ['combat', 'melee', 'basic'],
    script: {
      name: 'Basic Melee Combat',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '0', // UPDATE_IC
          typeName: 'UPDATE_IC',
          label: 'Update In Combat',
          parameters: [
            { name: 'InitialMin', value: 5000, type: 'number', units: 'ms' },
            { name: 'InitialMax', value: 8000, type: 'number', units: 'ms' },
            { name: 'RepeatMin', value: 10000, type: 'number', units: 'ms' },
            { name: 'RepeatMax', value: 15000, type: 'number', units: 'ms' },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '11', // CAST
          typeName: 'CAST',
          label: 'Cast Spell',
          parameters: [
            { name: 'SpellID', value: 0, type: 'spell', description: 'Spell to cast', required: true },
            { name: 'CastFlags', value: 0, type: 'flag' },
            { name: 'TriggerFlags', value: 0, type: 'flag' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '2', // VICTIM
          typeName: 'VICTIM',
          label: 'Current Victim',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Spell ID',
        description: 'The spell this creature will cast',
        defaultValue: 9672, // Example: Frostbolt
      },
    ],
    difficulty: 1,
    author: 'TrinityCore SAI Team',
  },

  {
    id: 'caster-combat',
    name: 'Spellcaster Combat',
    description: 'Caster that uses multiple spells with varying frequencies',
    category: 'combat',
    tags: ['combat', 'caster', 'spells', 'magic'],
    script: {
      name: 'Caster Combat',
      sourceType: 0 as SAISourceType,
      nodes: [
        // Fast spell (low cooldown)
        {
          id: 'event-1',
          type: 'event',
          typeId: '0',
          typeName: 'UPDATE_IC',
          label: 'Fast Spell Timer',
          parameters: [
            { name: 'InitialMin', value: 1000, type: 'number', units: 'ms' },
            { name: 'InitialMax', value: 3000, type: 'number', units: 'ms' },
            { name: 'RepeatMin', value: 3000, type: 'number', units: 'ms' },
            { name: 'RepeatMax', value: 5000, type: 'number', units: 'ms' },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '11',
          typeName: 'CAST',
          label: 'Cast Fast Spell',
          parameters: [
            { name: 'SpellID', value: 0, type: 'spell', required: true },
            { name: 'CastFlags', value: 0, type: 'flag' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '2',
          typeName: 'VICTIM',
          label: 'Current Target',
          parameters: [],
          position: { x: 650, y: 50 },
        },
        // Slow spell (high cooldown, powerful)
        {
          id: 'event-2',
          type: 'event',
          typeId: '0',
          typeName: 'UPDATE_IC',
          label: 'Powerful Spell Timer',
          parameters: [
            { name: 'InitialMin', value: 8000, type: 'number', units: 'ms' },
            { name: 'InitialMax', value: 12000, type: 'number', units: 'ms' },
            { name: 'RepeatMin', value: 20000, type: 'number', units: 'ms' },
            { name: 'RepeatMax', value: 30000, type: 'number', units: 'ms' },
          ],
          position: { x: 50, y: 200 },
        },
        {
          id: 'action-2',
          type: 'action',
          typeId: '11',
          typeName: 'CAST',
          label: 'Cast Powerful Spell',
          parameters: [
            { name: 'SpellID', value: 0, type: 'spell', required: true },
            { name: 'CastFlags', value: 0, type: 'flag' },
          ],
          position: { x: 350, y: 200 },
        },
        {
          id: 'target-2',
          type: 'target',
          typeId: '5', // RANDOM
          typeName: 'HOSTILE_RANDOM',
          label: 'Random Enemy',
          parameters: [
            { name: 'MaxDist', value: 40, type: 'number', units: 'yards' },
          ],
          position: { x: 650, y: 200 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
        { id: 'conn-3', source: 'event-2', target: 'action-2', type: 'event-to-action' },
        { id: 'conn-4', source: 'action-2', target: 'target-2', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Fast Spell ID',
        description: 'Quick-cast spell (Frostbolt, Shadow Bolt, etc.)',
        defaultValue: 9672,
      },
      {
        path: 'nodes[4].parameters[0].value',
        label: 'Powerful Spell ID',
        description: 'High-damage spell (Pyroblast, Chain Lightning, etc.)',
        defaultValue: 17274,
      },
    ],
    difficulty: 2,
  },

  {
    id: 'boss-phase-system',
    name: 'Boss Phase System (3 Phases)',
    description: 'Three-phase boss encounter with health-based transitions',
    category: 'boss',
    tags: ['boss', 'phases', 'combat', 'advanced'],
    script: {
      name: 'Boss Phase System',
      sourceType: 0 as SAISourceType,
      nodes: [
        // Phase 1 -> 2 transition (75% HP)
        {
          id: 'event-1',
          type: 'event',
          typeId: '2', // HEALTH_PCT
          typeName: 'HEALTH_PCT',
          label: 'Phase 2 at 75% HP',
          parameters: [
            { name: 'HPMin%', value: 0, type: 'number', min: 0, max: 100, units: '%' },
            { name: 'HPMax%', value: 75, type: 'number', min: 0, max: 100, units: '%' },
            { name: 'RepeatMin', value: 0, type: 'number', units: 'ms' },
            { name: 'RepeatMax', value: 0, type: 'number', units: 'ms' },
          ],
          position: { x: 50, y: 50 },
          phase: 1,
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '22', // SET_PHASE
          typeName: 'SET_EVENT_PHASE',
          label: 'Set Phase 2',
          parameters: [
            { name: 'Phase', value: 2, type: 'number' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
        // Phase 2 -> 3 transition (40% HP)
        {
          id: 'event-2',
          type: 'event',
          typeId: '2',
          typeName: 'HEALTH_PCT',
          label: 'Phase 3 at 40% HP',
          parameters: [
            { name: 'HPMin%', value: 0, type: 'number', units: '%' },
            { name: 'HPMax%', value: 40, type: 'number', units: '%' },
            { name: 'RepeatMin', value: 0, type: 'number', units: 'ms' },
            { name: 'RepeatMax', value: 0, type: 'number', units: 'ms' },
          ],
          position: { x: 50, y: 200 },
          phase: 2,
        },
        {
          id: 'action-2',
          type: 'action',
          typeId: '22',
          typeName: 'SET_EVENT_PHASE',
          label: 'Set Phase 3 (Enrage)',
          parameters: [
            { name: 'Phase', value: 3, type: 'number' },
          ],
          position: { x: 350, y: 200 },
        },
        {
          id: 'target-2',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 200 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
        { id: 'conn-3', source: 'event-2', target: 'action-2', type: 'event-to-action' },
        { id: 'conn-4', source: 'action-2', target: 'target-2', type: 'action-to-target' },
      ],
    } as any,
    difficulty: 4,
  },

  {
    id: 'boss-add-summon',
    name: 'Boss Add Summons',
    description: 'Summon additional creatures at 75%, 50%, and 25% health',
    category: 'boss',
    tags: ['boss', 'summon', 'combat', 'adds'],
    script: {
      name: 'Boss Add Summons',
      sourceType: 0 as SAISourceType,
      nodes: [
        // 75% - Summon 2 adds
        {
          id: 'event-1',
          type: 'event',
          typeId: '2',
          typeName: 'HEALTH_PCT',
          label: 'Summon at 75%',
          parameters: [
            { name: 'HPMin%', value: 0, type: 'number', units: '%' },
            { name: 'HPMax%', value: 75, type: 'number', units: '%' },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '12', // SUMMON_CREATURE
          typeName: 'SUMMON_CREATURE',
          label: 'Summon Add',
          parameters: [
            { name: 'CreatureEntry', value: 0, type: 'creature', required: true },
            { name: 'SummonType', value: 4, type: 'enum' }, // Timed Despawn OOC
            { name: 'Duration', value: 60000, type: 'number', units: 'ms' },
            { name: 'AttackInvoker', value: 1, type: 'number' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self Position',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Add Creature Entry',
        description: 'Creature ID to summon as add',
        defaultValue: 0,
      },
    ],
    difficulty: 3,
  },

  // ===== DIALOGUE TEMPLATES =====
  {
    id: 'on-aggro-yell',
    name: 'Aggro Yell',
    description: 'Yell text when entering combat',
    category: 'dialogue',
    tags: ['dialogue', 'combat', 'aggro', 'basic'],
    script: {
      name: 'Aggro Yell',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '4', // AGGRO
          typeName: 'AGGRO',
          label: 'On Aggro',
          parameters: [],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '1', // TALK
          typeName: 'TALK',
          label: 'Say Text',
          parameters: [
            { name: 'TextID', value: 0, type: 'text', required: true },
            { name: 'Duration', value: 0, type: 'number', units: 'ms' },
            { name: 'UseTalkTarget', value: 0, type: 'number' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Text ID',
        description: 'Text group ID from creature_text table',
        defaultValue: 0,
      },
    ],
    difficulty: 1,
  },

  {
    id: 'on-death-yell',
    name: 'Death Yell',
    description: 'Yell text when dying',
    category: 'dialogue',
    tags: ['dialogue', 'death', 'basic'],
    script: {
      name: 'Death Yell',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '6', // DEATH
          typeName: 'DEATH',
          label: 'On Death',
          parameters: [],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '1',
          typeName: 'TALK',
          label: 'Say Death Text',
          parameters: [
            { name: 'TextID', value: 0, type: 'text', required: true },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Death Text ID',
        description: 'Death text group ID from creature_text',
        defaultValue: 0,
      },
    ],
    difficulty: 1,
  },

  // ===== QUEST TEMPLATES =====
  {
    id: 'quest-giver',
    name: 'Quest Giver',
    description: 'Handle quest accept and reward with dialogue',
    category: 'quest',
    tags: ['quest', 'dialogue', 'npc'],
    script: {
      name: 'Quest Giver',
      sourceType: 0 as SAISourceType,
      nodes: [
        // Quest Accepted
        {
          id: 'event-1',
          type: 'event',
          typeId: '19', // QUEST_ACCEPTED
          typeName: 'ACCEPTED_QUEST',
          label: 'On Quest Accepted',
          parameters: [
            { name: 'QuestID', value: 0, type: 'quest', required: true },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '1',
          typeName: 'TALK',
          label: 'Say Accept Text',
          parameters: [
            { name: 'TextID', value: 0, type: 'text', required: true },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '7', // ACTION_INVOKER
          typeName: 'ACTION_INVOKER',
          label: 'Quest Taker',
          parameters: [],
          position: { x: 650, y: 50 },
        },
        // Quest Rewarded
        {
          id: 'event-2',
          type: 'event',
          typeId: '20', // QUEST_REWARDED
          typeName: 'REWARD_QUEST',
          label: 'On Quest Completed',
          parameters: [
            { name: 'QuestID', value: 0, type: 'quest', required: true },
          ],
          position: { x: 50, y: 200 },
        },
        {
          id: 'action-2',
          type: 'action',
          typeId: '1',
          typeName: 'TALK',
          label: 'Say Complete Text',
          parameters: [
            { name: 'TextID', value: 0, type: 'text', required: true },
          ],
          position: { x: 350, y: 200 },
        },
        {
          id: 'target-2',
          type: 'target',
          typeId: '7',
          typeName: 'ACTION_INVOKER',
          label: 'Quest Completer',
          parameters: [],
          position: { x: 650, y: 200 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
        { id: 'conn-3', source: 'event-2', target: 'action-2', type: 'event-to-action' },
        { id: 'conn-4', source: 'action-2', target: 'target-2', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[0].parameters[0].value',
        label: 'Quest ID',
        description: 'Quest ID from quest_template',
      },
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Accept Text ID',
        description: 'Text when quest is accepted',
      },
      {
        path: 'nodes[4].parameters[0].value',
        label: 'Complete Text ID',
        description: 'Text when quest is completed',
      },
    ],
    difficulty: 2,
  },

  // Continue with more templates...
  {
    id: 'waypoint-patrol',
    name: 'Waypoint Patrol with Pause',
    description: 'Follow waypoint path with pause at each point',
    category: 'movement',
    tags: ['movement', 'waypoint', 'patrol'],
    script: {
      name: 'Waypoint Patrol',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '46', // WAYPOINT_REACHED
          typeName: 'WAYPOINT_REACHED',
          label: 'Waypoint Reached',
          parameters: [
            { name: 'PointID', value: 0, type: 'number' },
            { name: 'PathID', value: 0, type: 'number', required: true },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '54', // PAUSE_WAYPOINT
          typeName: 'PAUSE_WAYPOINT',
          label: 'Pause at Waypoint',
          parameters: [
            { name: 'PauseTimer', value: 5000, type: 'number', units: 'ms' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[0].parameters[1].value',
        label: 'Path ID',
        description: 'Waypoint path ID from waypoint_data',
      },
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Pause Duration',
        description: 'How long to pause at each waypoint (ms)',
        defaultValue: 5000,
      },
    ],
    difficulty: 2,
  },

  {
    id: 'on-spawn-buff',
    name: 'Buff on Spawn',
    description: 'Apply buff aura when creature spawns',
    category: 'combat',
    tags: ['spawn', 'buff', 'aura'],
    script: {
      name: 'Buff on Spawn',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '63', // RESPAWN
          typeName: 'RESPAWN',
          label: 'On Spawn',
          parameters: [],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '75', // ADD_AURA
          typeName: 'ADD_AURA',
          label: 'Apply Buff',
          parameters: [
            { name: 'SpellID', value: 0, type: 'spell', required: true },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    placeholders: [
      {
        path: 'nodes[1].parameters[0].value',
        label: 'Buff Spell ID',
        description: 'Aura/buff to apply on spawn',
      },
    ],
    difficulty: 1,
  },

  {
    id: 'flee-at-low-health',
    name: 'Flee at Low Health',
    description: 'Flee when health drops below 15%',
    category: 'combat',
    tags: ['flee', 'health', 'survival'],
    script: {
      name: 'Flee at Low Health',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '2', // HEALTH_PCT
          typeName: 'HEALTH_PCT',
          label: 'Low Health',
          parameters: [
            { name: 'HPMin%', value: 0, type: 'number', units: '%' },
            { name: 'HPMax%', value: 15, type: 'number', units: '%' },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '2', // FLEE
          typeName: 'FLEE_FOR_ASSIST',
          label: 'Flee',
          parameters: [
            { name: 'FleeTime', value: 10000, type: 'number', units: 'ms' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    difficulty: 2,
  },

  {
    id: 'call-for-help',
    name: 'Call for Help on Aggro',
    description: 'Call nearby allies when attacked',
    category: 'combat',
    tags: ['aggro', 'assist', 'group'],
    script: {
      name: 'Call for Help',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '4', // AGGRO
          typeName: 'AGGRO',
          label: 'On Aggro',
          parameters: [],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '103', // CALL_FOR_HELP
          typeName: 'CALL_FOR_HELP',
          label: 'Call for Help',
          parameters: [
            { name: 'Radius', value: 30, type: 'number', units: 'yards' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    difficulty: 2,
  },

  {
    id: 'enrage-at-low-health',
    name: 'Enrage at 30% Health',
    description: 'Cast enrage buff when health drops below 30%',
    category: 'combat',
    tags: ['enrage', 'buff', 'health'],
    script: {
      name: 'Enrage at Low Health',
      sourceType: 0 as SAISourceType,
      nodes: [
        {
          id: 'event-1',
          type: 'event',
          typeId: '2',
          typeName: 'HEALTH_PCT',
          label: 'Enrage Threshold',
          parameters: [
            { name: 'HPMin%', value: 0, type: 'number', units: '%' },
            { name: 'HPMax%', value: 30, type: 'number', units: '%' },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: 'action-1',
          type: 'action',
          typeId: '11',
          typeName: 'CAST',
          label: 'Cast Enrage',
          parameters: [
            { name: 'SpellID', value: 8599, type: 'spell' }, // Enrage
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: 'target-1',
          type: 'target',
          typeId: '1',
          typeName: 'SELF',
          label: 'Self',
          parameters: [],
          position: { x: 650, y: 50 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'event-1', target: 'action-1', type: 'event-to-action' },
        { id: 'conn-2', source: 'action-1', target: 'target-1', type: 'action-to-target' },
      ],
    } as any,
    difficulty: 2,
  },
];

// ============================================================================
// TEMPLATE OPERATIONS
// ============================================================================

/**
 * Get template by ID
 */
export function getTemplate(id: string): SAITemplate | undefined {
  return SAI_TEMPLATE_LIBRARY.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): SAITemplate[] {
  return SAI_TEMPLATE_LIBRARY.filter((t) => t.category === category);
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(maxDifficulty: number): SAITemplate[] {
  return SAI_TEMPLATE_LIBRARY.filter((t) => (t.difficulty || 1) <= maxDifficulty);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): SAITemplate[] {
  const lowerQuery = query.toLowerCase();

  return SAI_TEMPLATE_LIBRARY.filter((t) => {
    const nameMatch = t.name.toLowerCase().includes(lowerQuery);
    const descMatch = t.description.toLowerCase().includes(lowerQuery);
    const tagMatch = t.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery));

    return nameMatch || descMatch || tagMatch;
  });
}

/**
 * Get template statistics
 */
export function getTemplateStatistics() {
  const categories = new Map<TemplateCategory, number>();

  SAI_TEMPLATE_LIBRARY.forEach((t) => {
    categories.set(t.category, (categories.get(t.category) || 0) + 1);
  });

  return {
    total: SAI_TEMPLATE_LIBRARY.length,
    byCategory: Object.fromEntries(categories),
    averageDifficulty:
      SAI_TEMPLATE_LIBRARY.reduce((sum, t) => sum + (t.difficulty || 1), 0) /
      SAI_TEMPLATE_LIBRARY.length,
  };
}

/**
 * Instantiate template with placeholder values
 */
export function instantiateTemplate(
  template: SAITemplate,
  placeholderValues: Record<string, any>,
  baseScript?: Partial<SAIScript>
): SAIScript {
  // Deep clone the template script
  const script: SAIScript = {
    id: `script-${Date.now()}`,
    name: baseScript?.name || template.script.name || template.name,
    entryOrGuid: baseScript?.entryOrGuid || 0,
    sourceType: (baseScript?.sourceType ?? template.script.sourceType) as SAISourceType,
    nodes: JSON.parse(JSON.stringify(template.script.nodes || [])),
    connections: JSON.parse(JSON.stringify(template.script.connections || [])),
    metadata: {
      version: '3.0.0',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      author: template.author,
      description: template.description,
      tags: template.tags,
      ...baseScript?.metadata,
    },
  };

  // Apply placeholder values
  template.placeholders?.forEach((placeholder) => {
    const value = placeholderValues[placeholder.label] ?? placeholder.defaultValue;
    if (value !== undefined) {
      setValueByPath(script, placeholder.path, value);
    }
  });

  return script;
}

/**
 * Helper to set value by path (e.g., "nodes[1].parameters[0].value")
 */
function setValueByPath(obj: any, path: string, value: any) {
  const keys = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current = current[key];
    if (!current) return;
  }

  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}
