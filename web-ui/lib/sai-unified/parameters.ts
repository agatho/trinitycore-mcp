/**
 * TrinityCore SAI Unified Editor - Parameter Definitions
 *
 * Comprehensive parameter configurations for all 282 SAI types.
 * Maps parameter names to type-safe definitions with validation.
 *
 * @module sai-unified/parameters
 * @version 3.0.0
 */

import type { SAIParameter } from './types';
import {
  SAI_EVENT_TYPES,
  SAI_ACTION_TYPES,
  SAI_TARGET_TYPES,
  getEventType,
  getActionType,
  getTargetType,
} from './constants';

// ============================================================================
// PARAMETER REGISTRY
// ============================================================================

/**
 * Central registry of all parameter definitions.
 * Each parameter has a unique configuration with type, validation, and metadata.
 */
export const PARAMETER_REGISTRY: Record<string, Omit<SAIParameter, 'name'>> = {
  // ===== TIMING PARAMETERS =====
  InitialMin: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Initial minimum time before first trigger',
    tooltip: 'Time in milliseconds before event can first trigger',
    required: false,
    defaultValue: 0,
  },
  InitialMax: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Initial maximum time before first trigger',
    tooltip: 'Random time range in milliseconds (InitialMin to InitialMax)',
    required: false,
    defaultValue: 0,
  },
  RepeatMin: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Minimum time between repeat triggers',
    tooltip: 'Time in milliseconds between event repetitions',
    required: false,
    defaultValue: 0,
  },
  RepeatMax: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Maximum time between repeat triggers',
    tooltip: 'Random time range in milliseconds (RepeatMin to RepeatMax)',
    required: false,
    defaultValue: 0,
  },
  CooldownMin: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Minimum cooldown before event can trigger again',
    tooltip: 'Minimum time in milliseconds before event is eligible again',
    defaultValue: 0,
  },
  CooldownMax: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Maximum cooldown before event can trigger again',
    tooltip: 'Maximum time in milliseconds (random CooldownMin to CooldownMax)',
    defaultValue: 0,
  },
  Duration: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Duration of effect',
    tooltip: 'How long the effect lasts in milliseconds',
    defaultValue: 0,
  },
  Delay: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Action execution delay',
    tooltip: 'Time in milliseconds before action executes',
    defaultValue: 0,
  },
  MinDelay: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Minimum delay',
    tooltip: 'Minimum time in milliseconds before action',
    defaultValue: 0,
  },
  MaxDelay: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Maximum delay',
    tooltip: 'Maximum time in milliseconds (random MinDelay to MaxDelay)',
    defaultValue: 0,
  },
  Time: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Time duration',
    tooltip: 'Generic time value in milliseconds',
    defaultValue: 0,
  },
  Timer: {
    value: 0,
    type: 'number',
    min: 0,
    units: 's',
    description: 'Timer duration',
    tooltip: 'Time in seconds',
    defaultValue: 0,
  },
  DespawnTime: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Time before automatic despawn',
    tooltip: 'Milliseconds before summoned entity despawns (0 = never)',
    defaultValue: 0,
  },
  FleeTime: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Time to flee',
    tooltip: 'How long creature flees in milliseconds',
    defaultValue: 0,
  },
  PauseTimer: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Waypoint pause duration',
    tooltip: 'Time to pause at waypoint in milliseconds',
    defaultValue: 0,
  },
  TransitionTime: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Transition duration',
    tooltip: 'Time for transition effect in milliseconds',
    defaultValue: 0,
  },

  // ===== HEALTH/MANA PARAMETERS =====
  'HPMin%': {
    value: 0,
    type: 'number',
    min: 0,
    max: 100,
    units: '%',
    description: 'Minimum health percentage',
    tooltip: 'Trigger when health is above this percentage',
    required: true,
    defaultValue: 0,
  },
  'HPMax%': {
    value: 100,
    type: 'number',
    min: 0,
    max: 100,
    units: '%',
    description: 'Maximum health percentage',
    tooltip: 'Trigger when health is below this percentage',
    required: true,
    defaultValue: 100,
  },
  'ManaMin%': {
    value: 0,
    type: 'number',
    min: 0,
    max: 100,
    units: '%',
    description: 'Minimum mana percentage',
    tooltip: 'Trigger when mana is above this percentage',
    defaultValue: 0,
  },
  'ManaMax%': {
    value: 100,
    type: 'number',
    min: 0,
    max: 100,
    units: '%',
    description: 'Maximum mana percentage',
    tooltip: 'Trigger when mana is below this percentage',
    defaultValue: 100,
  },
  HPDeficit: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Health deficit amount',
    tooltip: 'Trigger when missing this much health',
    defaultValue: 0,
  },
  MinHP: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Minimum health value',
    tooltip: 'Set health to at least this value',
    defaultValue: 1,
  },

  // ===== SPELL PARAMETERS =====
  SpellID: {
    value: 0,
    type: 'spell',
    description: 'Spell ID from Spell.dbc/db2',
    tooltip: 'The spell to cast, check, or reference',
    required: true,
    defaultValue: 0,
  },
  School: {
    value: 0,
    type: 'enum',
    description: 'Spell school mask',
    tooltip: 'Bitwise mask for spell schools',
    options: [
      { value: 0, label: 'Any School', description: 'Match any spell school' },
      { value: 1, label: 'Physical', description: 'Physical damage' },
      { value: 2, label: 'Holy', description: 'Holy magic' },
      { value: 4, label: 'Fire', description: 'Fire magic' },
      { value: 8, label: 'Nature', description: 'Nature magic' },
      { value: 16, label: 'Frost', description: 'Frost magic' },
      { value: 32, label: 'Shadow', description: 'Shadow magic' },
      { value: 64, label: 'Arcane', description: 'Arcane magic' },
    ],
    defaultValue: 0,
  },
  CastFlags: {
    value: 0,
    type: 'flag',
    description: 'Spell cast flags',
    tooltip: 'Bitwise flags controlling spell casting behavior',
    defaultValue: 0,
  },
  TriggerFlags: {
    value: 0,
    type: 'flag',
    description: 'Spell trigger flags',
    tooltip: 'Bitwise flags for spell triggering (0 = normal, 1 = triggered)',
    defaultValue: 0,
  },
  StackCount: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Aura stack count',
    tooltip: 'Number of aura stacks required',
    defaultValue: 1,
  },
  AuraType: {
    value: 0,
    type: 'number',
    description: 'Aura type ID',
    tooltip: 'Spell aura effect type',
    defaultValue: 0,
  },

  // ===== CREATURE PARAMETERS =====
  CreatureEntry: {
    value: 0,
    type: 'creature',
    description: 'Creature entry from creature_template',
    tooltip: 'The creature template ID to spawn, check, or reference',
    required: true,
    defaultValue: 0,
  },
  CreatureID: {
    value: 0,
    type: 'creature',
    description: 'Creature entry ID',
    tooltip: 'Creature template ID',
    required: true,
    defaultValue: 0,
  },
  Entry: {
    value: 0,
    type: 'creature',
    description: 'Creature entry',
    tooltip: 'Creature template ID from database',
    defaultValue: 0,
  },
  EndCreatureEntry: {
    value: 0,
    type: 'creature',
    description: 'End creature entry for range',
    tooltip: 'Upper bound for creature entry range',
    defaultValue: 0,
  },
  ModelID: {
    value: 0,
    type: 'number',
    description: 'Display model ID',
    tooltip: 'Creature display model ID',
    defaultValue: 0,
  },
  VehicleEntry: {
    value: 0,
    type: 'creature',
    description: 'Vehicle creature entry',
    tooltip: 'Creature entry for vehicle',
    defaultValue: 0,
  },
  VehicleSeat: {
    value: 0,
    type: 'number',
    description: 'Vehicle seat ID',
    tooltip: 'Which seat in the vehicle (0-7)',
    min: 0,
    max: 7,
    defaultValue: 0,
  },

  // ===== ITEM PARAMETERS =====
  ItemID: {
    value: 0,
    type: 'item',
    description: 'Item entry from item_template',
    tooltip: 'The item template ID to give, check, or reference',
    required: true,
    defaultValue: 0,
  },
  Count: {
    value: 1,
    type: 'number',
    min: 1,
    description: 'Item count',
    tooltip: 'Number of items',
    defaultValue: 1,
  },

  // ===== QUEST PARAMETERS =====
  QuestID: {
    value: 0,
    type: 'quest',
    description: 'Quest ID from quest_template',
    tooltip: 'The quest template ID to offer, check, or reference',
    required: true,
    defaultValue: 0,
  },
  Quest: {
    value: 0,
    type: 'quest',
    description: 'Quest ID',
    tooltip: 'Quest template ID',
    defaultValue: 0,
  },
  Fail: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Fail quest',
    tooltip: '0 = complete quest, 1 = fail quest',
    options: [
      { value: 0, label: 'Complete' },
      { value: 1, label: 'Fail' },
    ],
    defaultValue: 0,
  },
  DirectAdd: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Direct add to log',
    tooltip: '0 = offer quest, 1 = add directly to log',
    options: [
      { value: 0, label: 'Offer Quest' },
      { value: 1, label: 'Add to Log' },
    ],
    defaultValue: 0,
  },
  ObjectiveID: {
    value: 0,
    type: 'number',
    description: 'Quest objective ID',
    tooltip: 'Specific quest objective to complete',
    defaultValue: 0,
  },

  // ===== GAMEOBJECT PARAMETERS =====
  GameobjectEntry: {
    value: 0,
    type: 'gameobject',
    description: 'Gameobject entry from gameobject_template',
    tooltip: 'The gameobject template ID to spawn or reference',
    required: true,
    defaultValue: 0,
  },
  GameobjectID: {
    value: 0,
    type: 'gameobject',
    description: 'Gameobject entry ID',
    tooltip: 'Gameobject template ID',
    defaultValue: 0,
  },

  // ===== TEXT PARAMETERS =====
  TextID: {
    value: 0,
    type: 'text',
    description: 'Text ID from creature_text',
    tooltip: 'The text group ID to display',
    required: true,
    defaultValue: 0,
  },
  UseTalkTarget: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Use talk target',
    tooltip: '0 = broadcast, 1 = whisper to target',
    options: [
      { value: 0, label: 'Broadcast' },
      { value: 1, label: 'Whisper' },
    ],
    defaultValue: 0,
  },

  // ===== DISTANCE/RANGE PARAMETERS =====
  MinDist: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'yards',
    description: 'Minimum distance',
    tooltip: 'Minimum distance in yards',
    defaultValue: 0,
  },
  MaxDist: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'yards',
    description: 'Maximum distance',
    tooltip: 'Maximum distance in yards (0 = infinite)',
    defaultValue: 0,
  },
  MaxRange: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'yards',
    description: 'Maximum range',
    tooltip: 'Maximum range in yards',
    defaultValue: 0,
  },
  Distance: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'yards',
    description: 'Distance',
    tooltip: 'Distance in yards',
    defaultValue: 0,
  },
  Radius: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'yards',
    description: 'Search radius',
    tooltip: 'Radius for area search in yards',
    defaultValue: 0,
  },

  // ===== DAMAGE PARAMETERS =====
  MinDmg: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Minimum damage',
    tooltip: 'Minimum damage amount',
    defaultValue: 0,
  },
  MaxDmg: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Maximum damage',
    tooltip: 'Maximum damage amount',
    defaultValue: 0,
  },
  MinHeal: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Minimum heal amount',
    tooltip: 'Minimum healing amount',
    defaultValue: 0,
  },
  MaxHeal: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Maximum heal amount',
    tooltip: 'Maximum healing amount',
    defaultValue: 0,
  },

  // ===== FACTION PARAMETERS =====
  FactionID: {
    value: 0,
    type: 'faction',
    description: 'Faction ID from FactionTemplate.dbc',
    tooltip: 'The faction template ID to set',
    defaultValue: 0,
  },
  Team: {
    value: 0,
    type: 'enum',
    description: 'Player team',
    tooltip: 'Faction team requirement',
    options: [
      { value: 0, label: 'Any Team', description: 'Any faction' },
      { value: 469, label: 'Alliance', description: 'Alliance players only' },
      { value: 67, label: 'Horde', description: 'Horde players only' },
    ],
    defaultValue: 0,
  },

  // ===== EMOTE PARAMETERS =====
  EmoteID: {
    value: 0,
    type: 'emote',
    description: 'Emote ID from Emotes.dbc',
    tooltip: 'The emote animation to play',
    defaultValue: 0,
  },
  Emote1: { value: 0, type: 'emote', description: 'Emote 1', tooltip: 'First emote ID', defaultValue: 0 },
  Emote2: { value: 0, type: 'emote', description: 'Emote 2', tooltip: 'Second emote ID', defaultValue: 0 },
  Emote3: { value: 0, type: 'emote', description: 'Emote 3', tooltip: 'Third emote ID', defaultValue: 0 },
  Emote4: { value: 0, type: 'emote', description: 'Emote 4', tooltip: 'Fourth emote ID', defaultValue: 0 },

  // ===== SOUND PARAMETERS =====
  SoundID: {
    value: 0,
    type: 'sound',
    description: 'Sound ID from SoundEntries.dbc',
    tooltip: 'The sound entry to play',
    defaultValue: 0,
  },
  Sound1: { value: 0, type: 'sound', description: 'Sound 1', tooltip: 'First sound ID', defaultValue: 0 },
  Sound2: { value: 0, type: 'sound', description: 'Sound 2', tooltip: 'Second sound ID', defaultValue: 0 },
  Sound3: { value: 0, type: 'sound', description: 'Sound 3', tooltip: 'Third sound ID', defaultValue: 0 },
  Sound4: { value: 0, type: 'sound', description: 'Sound 4', tooltip: 'Fourth sound ID', defaultValue: 0 },

  // ===== MAP/ZONE/AREA PARAMETERS =====
  MapID: {
    value: 0,
    type: 'map',
    description: 'Map ID',
    tooltip: 'World map ID (0 = Eastern Kingdoms, 1 = Kalimdor, etc.)',
    defaultValue: 0,
  },
  ZoneID: {
    value: 0,
    type: 'zone',
    description: 'Zone ID',
    tooltip: 'Zone area ID',
    defaultValue: 0,
  },
  AreaTriggerID: {
    value: 0,
    type: 'area',
    description: 'Areatrigger ID',
    tooltip: 'Area trigger entry ID',
    defaultValue: 0,
  },

  // ===== POSITION PARAMETERS =====
  X: {
    value: 0,
    type: 'number',
    description: 'X coordinate',
    tooltip: 'World X position',
    defaultValue: 0,
  },
  Y: {
    value: 0,
    type: 'number',
    description: 'Y coordinate',
    tooltip: 'World Y position',
    defaultValue: 0,
  },
  Z: {
    value: 0,
    type: 'number',
    description: 'Z coordinate',
    tooltip: 'World Z position (height)',
    defaultValue: 0,
  },
  O: {
    value: 0,
    type: 'number',
    description: 'Orientation',
    tooltip: 'Facing direction in radians (0-6.28)',
    min: 0,
    max: 6.28,
    defaultValue: 0,
  },
  Orientation: {
    value: 0,
    type: 'number',
    description: 'Orientation',
    tooltip: 'Facing direction in radians',
    min: 0,
    max: 6.28,
    defaultValue: 0,
  },
  Angle: {
    value: 0,
    type: 'number',
    description: 'Angle',
    tooltip: 'Angle in radians',
    defaultValue: 0,
  },

  // ===== MOVEMENT PARAMETERS =====
  MovementType: {
    value: 0,
    type: 'enum',
    description: 'Movement type',
    tooltip: 'Creature movement behavior',
    options: [
      { value: 0, label: 'Idle', description: 'Stay in place' },
      { value: 1, label: 'Random', description: 'Random movement in range' },
      { value: 2, label: 'Waypoint', description: 'Follow waypoint path' },
    ],
    defaultValue: 0,
  },
  PathID: {
    value: 0,
    type: 'number',
    description: 'Waypoint path ID',
    tooltip: 'Path ID from waypoint_data',
    defaultValue: 0,
  },
  PointID: {
    value: 0,
    type: 'number',
    description: 'Point/Waypoint ID',
    tooltip: 'Specific waypoint or movement point ID',
    defaultValue: 0,
  },
  Run: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Run mode',
    tooltip: '0 = walk, 1 = run',
    options: [
      { value: 0, label: 'Walk' },
      { value: 1, label: 'Run' },
    ],
    defaultValue: 1,
  },
  Repeat: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Repeat path',
    tooltip: '0 = once, 1 = loop',
    options: [
      { value: 0, label: 'Once' },
      { value: 1, label: 'Loop' },
    ],
    defaultValue: 0,
  },
  SpeedXY: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'XY speed',
    tooltip: 'Horizontal movement speed',
    defaultValue: 0,
  },
  SpeedZ: {
    value: 0,
    type: 'number',
    description: 'Z speed',
    tooltip: 'Vertical movement speed',
    defaultValue: 0,
  },
  SpeedType: {
    value: 0,
    type: 'enum',
    description: 'Movement speed type',
    tooltip: 'Which speed type to modify',
    options: [
      { value: 0, label: 'Walk' },
      { value: 1, label: 'Run' },
    ],
    defaultValue: 1,
  },
  Speed: {
    value: 1,
    type: 'number',
    min: 0,
    description: 'Speed multiplier',
    tooltip: 'Speed multiplier (1.0 = normal)',
    defaultValue: 1,
  },
  TaxiID: {
    value: 0,
    type: 'number',
    description: 'Taxi path ID',
    tooltip: 'Flight path ID',
    defaultValue: 0,
  },
  Fly: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Can fly',
    tooltip: '0 = ground only, 1 = can fly',
    options: [
      { value: 0, label: 'Ground' },
      { value: 1, label: 'Flying' },
    ],
    defaultValue: 0,
  },
  Swim: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Can swim',
    tooltip: '0 = cannot swim, 1 = can swim',
    options: [
      { value: 0, label: 'No Swimming' },
      { value: 1, label: 'Swimming' },
    ],
    defaultValue: 0,
  },
  Root: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Root state',
    tooltip: '0 = unroot, 1 = root (cannot move)',
    options: [
      { value: 0, label: 'Unroot' },
      { value: 1, label: 'Root' },
    ],
    defaultValue: 0,
  },
  AllowMovement: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Allow movement',
    tooltip: '0 = disable movement, 1 = enable movement',
    options: [
      { value: 0, label: 'Disable' },
      { value: 1, label: 'Enable' },
    ],
    defaultValue: 1,
  },

  // ===== WAYPOINT PARAMETERS =====
  WP1: { value: 0, type: 'number', description: 'Waypoint 1', tooltip: 'First waypoint ID', defaultValue: 0 },
  WP2: { value: 0, type: 'number', description: 'Waypoint 2', tooltip: 'Second waypoint ID', defaultValue: 0 },
  WP3: { value: 0, type: 'number', description: 'Waypoint 3', tooltip: 'Third waypoint ID', defaultValue: 0 },
  WP4: { value: 0, type: 'number', description: 'Waypoint 4', tooltip: 'Fourth waypoint ID', defaultValue: 0 },

  // ===== PHASE PARAMETERS =====
  Phase: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Event phase',
    tooltip: 'Phase mask (0 = all phases)',
    defaultValue: 0,
  },
  Phase1: { value: 0, type: 'number', description: 'Phase 1', tooltip: 'First phase', defaultValue: 0 },
  Phase2: { value: 0, type: 'number', description: 'Phase 2', tooltip: 'Second phase', defaultValue: 0 },
  Phase3: { value: 0, type: 'number', description: 'Phase 3', tooltip: 'Third phase', defaultValue: 0 },
  Phase4: { value: 0, type: 'number', description: 'Phase 4', tooltip: 'Fourth phase', defaultValue: 0 },
  PhaseMin: { value: 0, type: 'number', description: 'Minimum phase', tooltip: 'Lower phase bound', defaultValue: 0 },
  PhaseMax: { value: 0, type: 'number', description: 'Maximum phase', tooltip: 'Upper phase bound', defaultValue: 0 },
  FromPhase: { value: 0, type: 'number', description: 'From phase', tooltip: 'Starting phase', defaultValue: 0 },
  ToPhase: { value: 0, type: 'number', description: 'To phase', tooltip: 'Ending phase', defaultValue: 0 },

  // ===== SUMMON PARAMETERS =====
  SummonType: {
    value: 1,
    type: 'enum',
    description: 'Summon type',
    tooltip: 'How the summoned creature despawns',
    options: [
      { value: 1, label: 'Timed or Dead Despawn', description: 'Despawn after duration or on death' },
      { value: 2, label: 'Timed or Corpse Despawn', description: 'Despawn after duration or corpse decay' },
      { value: 3, label: 'Timed Despawn', description: 'Despawn after duration' },
      { value: 4, label: 'Timed Despawn OOC', description: 'Despawn after duration out of combat' },
      { value: 5, label: 'Corpse Despawn', description: 'Despawn on corpse decay' },
      { value: 6, label: 'Corpse Timed Despawn', description: 'Corpse despawn with timer' },
      { value: 7, label: 'Dead Despawn', description: 'Despawn on death' },
      { value: 8, label: 'Manual Despawn', description: 'Only despawn via script' },
    ],
    required: true,
    defaultValue: 1,
  },
  AttackInvoker: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Attack invoker',
    tooltip: '0 = passive, 1 = attack summoner\'s target',
    options: [
      { value: 0, label: 'Passive' },
      { value: 1, label: 'Attack' },
    ],
    defaultValue: 0,
  },

  // ===== THREAT PARAMETERS =====
  ThreatPCT: {
    value: 0,
    type: 'number',
    description: 'Threat percentage',
    tooltip: 'Threat amount as percentage',
    defaultValue: 0,
  },
  Threat: {
    value: 0,
    type: 'number',
    description: 'Threat amount',
    tooltip: 'Absolute threat value',
    defaultValue: 0,
  },

  // ===== STATE PARAMETERS =====
  State: {
    value: 0,
    type: 'enum',
    description: 'React state',
    tooltip: 'AI reaction behavior',
    options: [
      { value: 0, label: 'Passive', description: 'Never attack' },
      { value: 1, label: 'Defensive', description: 'Attack when attacked' },
      { value: 2, label: 'Aggressive', description: 'Attack on sight' },
    ],
    defaultValue: 1,
  },
  Sheath: {
    value: 0,
    type: 'enum',
    description: 'Sheath state',
    tooltip: 'Weapon sheath state',
    options: [
      { value: 0, label: 'Unarmed', description: 'No weapons drawn' },
      { value: 1, label: 'Melee', description: 'Melee weapon drawn' },
      { value: 2, label: 'Ranged', description: 'Ranged weapon drawn' },
    ],
    defaultValue: 0,
  },
  Regen: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Health regen',
    tooltip: '0 = disable, 1 = enable',
    options: [
      { value: 0, label: 'Disabled' },
      { value: 1, label: 'Enabled' },
    ],
    defaultValue: 1,
  },
  PowerType: {
    value: 0,
    type: 'enum',
    description: 'Power type',
    tooltip: 'Resource type',
    options: [
      { value: 0, label: 'Mana' },
      { value: 1, label: 'Rage' },
      { value: 2, label: 'Focus' },
      { value: 3, label: 'Energy' },
      { value: 4, label: 'Happiness' },
    ],
    defaultValue: 0,
  },
  Power: {
    value: 0,
    type: 'number',
    description: 'Power amount',
    tooltip: 'Amount of resource (mana, rage, etc.)',
    defaultValue: 0,
  },

  // ===== FLAG PARAMETERS =====
  Flags: {
    value: 0,
    type: 'flag',
    description: 'Flags',
    tooltip: 'Bitwise flags',
    defaultValue: 0,
  },
  AllowAttackState: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Allow attack',
    tooltip: '0 = disable attacks, 1 = enable attacks',
    options: [
      { value: 0, label: 'Disable' },
      { value: 1, label: 'Enable' },
    ],
    defaultValue: 1,
  },

  // ===== INCREMENT/DECREMENT PARAMETERS =====
  Increment: {
    value: 0,
    type: 'number',
    description: 'Increment amount',
    tooltip: 'Value to add',
    defaultValue: 1,
  },
  Decrement: {
    value: 0,
    type: 'number',
    description: 'Decrement amount',
    tooltip: 'Value to subtract',
    defaultValue: 1,
  },
  IncDec: {
    value: 0,
    type: 'enum',
    description: 'Increase/Decrease',
    tooltip: 'Operation type',
    options: [
      { value: 0, label: 'Increase' },
      { value: 1, label: 'Decrease' },
    ],
    defaultValue: 0,
  },

  // ===== DATA/FIELD PARAMETERS =====
  Field: {
    value: 0,
    type: 'number',
    description: 'Data field',
    tooltip: 'Data index or field number',
    defaultValue: 0,
  },
  Value: {
    value: 0,
    type: 'number',
    description: 'Data value',
    tooltip: 'Value to set',
    defaultValue: 0,
  },
  Data: {
    value: 0,
    type: 'number',
    description: 'Data value',
    tooltip: 'Generic data value',
    defaultValue: 0,
  },
  Bytes: {
    value: 0,
    type: 'number',
    description: 'Bytes value',
    tooltip: 'Byte field value',
    defaultValue: 0,
  },
  Type: {
    value: 0,
    type: 'number',
    description: 'Type',
    tooltip: 'Generic type value',
    defaultValue: 0,
  },

  // ===== ID PARAMETERS =====
  ID: {
    value: 0,
    type: 'number',
    description: 'Generic ID',
    tooltip: 'Generic identifier',
    defaultValue: 0,
  },
  ID1: { value: 0, type: 'number', description: 'ID 1', tooltip: 'First ID', defaultValue: 0 },
  ID2: { value: 0, type: 'number', description: 'ID 2', tooltip: 'Second ID', defaultValue: 0 },
  ID3: { value: 0, type: 'number', description: 'ID 3', tooltip: 'Third ID', defaultValue: 0 },
  IDMin: { value: 0, type: 'number', description: 'Minimum ID', tooltip: 'Lower ID bound', defaultValue: 0 },
  IDMax: { value: 0, type: 'number', description: 'Maximum ID', tooltip: 'Upper ID bound', defaultValue: 0 },
  GroupID: { value: 0, type: 'number', description: 'Group ID', tooltip: 'Group identifier', defaultValue: 0 },
  EventID: { value: 0, type: 'number', description: 'Event ID', tooltip: 'Event identifier', defaultValue: 0 },
  CounterID: { value: 0, type: 'number', description: 'Counter ID', tooltip: 'Counter identifier', defaultValue: 0 },
  MenuID: { value: 0, type: 'number', description: 'Gossip menu ID', tooltip: 'Gossip menu identifier', defaultValue: 0 },
  OptionID: { value: 0, type: 'number', description: 'Gossip option ID', tooltip: 'Gossip option identifier', defaultValue: 0 },
  TemplateID: {
    value: 0,
    type: 'enum',
    description: 'AI template',
    tooltip: 'Predefined AI behavior template',
    options: [
      { value: 0, label: 'Basic Melee', description: 'Simple melee attacker' },
      { value: 1, label: 'Caster', description: 'Spellcaster' },
      { value: 2, label: 'Turret', description: 'Stationary attacker' },
      { value: 3, label: 'Passive', description: 'Non-aggressive' },
      { value: 4, label: 'Caged GO', description: 'Caged gameobject' },
      { value: 5, label: 'Caged Creature', description: 'Caged creature' },
    ],
    defaultValue: 0,
  },
  EquipmentID: {
    value: 0,
    type: 'number',
    description: 'Equipment template ID',
    tooltip: 'Equipment from creature_equip_template',
    defaultValue: 0,
  },
  MovieID: { value: 0, type: 'number', description: 'Movie ID', tooltip: 'Cinematic movie ID', defaultValue: 0 },
  CinematicID: { value: 0, type: 'number', description: 'Cinematic ID', tooltip: 'In-game cinematic ID', defaultValue: 0 },
  AnimID: { value: 0, type: 'number', description: 'Animation ID', tooltip: 'Animation kit ID', defaultValue: 0 },
  AnimKitID: { value: 0, type: 'number', description: 'AnimKit ID', tooltip: 'Animation kit ID', defaultValue: 0 },
  KitID: { value: 0, type: 'number', description: 'Spell visual kit ID', tooltip: 'Visual effect kit', defaultValue: 0 },
  SceneID: { value: 0, type: 'number', description: 'Scene ID', tooltip: 'Scene package ID', defaultValue: 0 },
  SpawnID: { value: 0, type: 'number', description: 'Spawn ID', tooltip: 'Spawn GUID', defaultValue: 0 },
  ActionID: { value: 0, type: 'number', description: 'Action ID', tooltip: 'Script action ID', defaultValue: 0 },
  AreaLightID: { value: 0, type: 'number', description: 'Area light ID', tooltip: 'Area lighting ID', defaultValue: 0 },
  ConversationID: { value: 0, type: 'number', description: 'Conversation ID', tooltip: 'Conversation template ID', defaultValue: 0 },

  // ===== BOOLEAN FLAGS =====
  OnlySelf: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Only self',
    tooltip: '0 = affect others, 1 = only self',
    options: [
      { value: 0, label: 'Others' },
      { value: 1, label: 'Self Only' },
    ],
    defaultValue: 0,
  },
  Apply: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Apply effect',
    tooltip: '0 = remove, 1 = apply',
    options: [
      { value: 0, label: 'Remove' },
      { value: 1, label: 'Apply' },
    ],
    defaultValue: 1,
  },
  Percent: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Is percent',
    tooltip: '0 = flat value, 1 = percentage',
    options: [
      { value: 0, label: 'Flat' },
      { value: 1, label: 'Percent' },
    ],
    defaultValue: 0,
  },
  Visibility: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Visibility',
    tooltip: '0 = invisible, 1 = visible',
    options: [
      { value: 0, label: 'Invisible' },
      { value: 1, label: 'Visible' },
    ],
    defaultValue: 1,
  },
  Active: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Active state',
    tooltip: '0 = inactive, 1 = active',
    options: [
      { value: 0, label: 'Inactive' },
      { value: 1, label: 'Active' },
    ],
    defaultValue: 1,
  },
  Disable: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Disable',
    tooltip: '0 = enable, 1 = disable',
    options: [
      { value: 0, label: 'Enable' },
      { value: 1, label: 'Disable' },
    ],
    defaultValue: 0,
  },
  Reset: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Reset counter',
    tooltip: '0 = modify, 1 = reset to 0',
    options: [
      { value: 0, label: 'Modify' },
      { value: 1, label: 'Reset' },
    ],
    defaultValue: 0,
  },
  Force: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Force',
    tooltip: '0 = normal, 1 = force',
    options: [
      { value: 0, label: 'Normal' },
      { value: 1, label: 'Force' },
    ],
    defaultValue: 0,
  },
  Enable: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Enable',
    tooltip: '0 = disable, 1 = enable',
    options: [
      { value: 0, label: 'Disable' },
      { value: 1, label: 'Enable' },
    ],
    defaultValue: 1,
  },
  Immune: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Immune',
    tooltip: '0 = not immune, 1 = immune',
    options: [
      { value: 0, label: 'Not Immune' },
      { value: 1, label: 'Immune' },
    ],
    defaultValue: 0,
  },
  Uninteractible: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Uninteractible',
    tooltip: '0 = interactible, 1 = cannot interact',
    options: [
      { value: 0, label: 'Interactible' },
      { value: 1, label: 'Uninteractible' },
    ],
    defaultValue: 0,
  },
  UseSAITargetAsGameEventSource: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Use SAI target as game event source',
    tooltip: '0 = use self, 1 = use SAI target',
    options: [
      { value: 0, label: 'Use Self' },
      { value: 1, label: 'Use Target' },
    ],
    defaultValue: 0,
  },

  // ===== TARGET PARAMETERS =====
  GUID: {
    value: 0,
    type: 'number',
    description: 'Creature GUID',
    tooltip: 'Specific creature spawn GUID',
    defaultValue: 0,
  },
  Alive: {
    value: 1,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Alive only',
    tooltip: '0 = include dead, 1 = alive only',
    options: [
      { value: 0, label: 'Any State' },
      { value: 1, label: 'Alive Only' },
    ],
    defaultValue: 1,
  },
  PlayerOnly: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Player only',
    tooltip: '0 = any creature, 1 = players only',
    options: [
      { value: 0, label: 'Any Creature' },
      { value: 1, label: 'Players Only' },
    ],
    defaultValue: 0,
  },
  SeatID: {
    value: 0,
    type: 'number',
    description: 'Vehicle seat ID',
    tooltip: 'Specific vehicle seat (0-7)',
    min: 0,
    max: 7,
    defaultValue: 0,
  },

  // ===== MISCELLANEOUS PARAMETERS =====
  HostileCrew: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Hostile or friendly',
    tooltip: '0 = hostile, 1 = friendly',
    options: [
      { value: 0, label: 'Hostile' },
      { value: 1, label: 'Friendly' },
    ],
    defaultValue: 0,
  },
  OnRemove: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'On remove',
    tooltip: '0 = on apply, 1 = on remove',
    options: [
      { value: 0, label: 'On Apply' },
      { value: 1, label: 'On Remove' },
    ],
    defaultValue: 0,
  },
  Charges: {
    value: 0,
    type: 'number',
    min: 0,
    description: 'Number of charges',
    tooltip: 'How many times effect can trigger',
    defaultValue: 0,
  },
  WeatherType: {
    value: 0,
    type: 'number',
    description: 'Weather type',
    tooltip: 'Weather effect type',
    defaultValue: 0,
  },
  Grade: {
    value: 0,
    type: 'number',
    min: 0,
    max: 1,
    description: 'Weather grade',
    tooltip: 'Weather intensity (0.0-1.0)',
    defaultValue: 0,
  },
  InitMin: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Initial min time',
    tooltip: 'Initial minimum time in milliseconds',
    defaultValue: 0,
  },
  InitMax: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Initial max time',
    tooltip: 'Initial maximum time in milliseconds',
    defaultValue: 0,
  },
  RepeatMin: {
    value: 0,
    type: 'number',
    min: 0,
    units: 'ms',
    description: 'Repeat min time',
    tooltip: 'Minimum repeat time in milliseconds',
    defaultValue: 0,
  },
};

// ============================================================================
// PARAMETER BUILDER FUNCTIONS
// ============================================================================

/**
 * Get parameter definitions for an event type
 */
export function getParametersForEvent(eventTypeId: string): SAIParameter[] {
  const eventType = getEventType(eventTypeId);
  if (!eventType) return [];

  return eventType.params.map((paramName) => {
    const baseParam = PARAMETER_REGISTRY[paramName];
    if (baseParam) {
      return {
        name: paramName,
        ...baseParam,
      };
    }

    // Fallback for unknown parameters
    return {
      name: paramName,
      value: 0,
      type: 'number' as const,
      description: paramName,
      tooltip: `Parameter: ${paramName}`,
      defaultValue: 0,
    };
  });
}

/**
 * Get parameter definitions for an action type
 */
export function getParametersForAction(actionTypeId: string): SAIParameter[] {
  const actionType = getActionType(actionTypeId);
  if (!actionType) return [];

  return actionType.params.map((paramName) => {
    const baseParam = PARAMETER_REGISTRY[paramName];
    if (baseParam) {
      return {
        name: paramName,
        ...baseParam,
      };
    }

    // Fallback for unknown parameters
    return {
      name: paramName,
      value: 0,
      type: 'number' as const,
      description: paramName,
      tooltip: `Parameter: ${paramName}`,
      defaultValue: 0,
    };
  });
}

/**
 * Get parameter definitions for a target type
 */
export function getParametersForTarget(targetTypeId: string): SAIParameter[] {
  const targetType = getTargetType(targetTypeId);
  if (!targetType) return [];

  return targetType.params.map((paramName) => {
    const baseParam = PARAMETER_REGISTRY[paramName];
    if (baseParam) {
      return {
        name: paramName,
        ...baseParam,
      };
    }

    // Fallback for unknown parameters
    return {
      name: paramName,
      value: 0,
      type: 'number' as const,
      description: paramName,
      tooltip: `Parameter: ${paramName}`,
      defaultValue: 0,
    };
  });
}

/**
 * Get a single parameter definition by name
 */
export function getParameterDefinition(paramName: string): SAIParameter | null {
  const baseParam = PARAMETER_REGISTRY[paramName];
  if (!baseParam) return null;

  return {
    name: paramName,
    ...baseParam,
  };
}

/**
 * Validate a parameter value
 */
export function validateParameter(param: SAIParameter): string | null {
  // Check custom validation function
  if (param.validation) {
    return param.validation(param.value);
  }

  // Check required
  if (param.required && (param.value === 0 || param.value === '')) {
    return `${param.name} is required`;
  }

  // Check min/max for numbers
  if (typeof param.value === 'number') {
    if (param.min !== undefined && param.value < param.min) {
      return `${param.name} must be at least ${param.min}${param.units ? ' ' + param.units : ''}`;
    }
    if (param.max !== undefined && param.value > param.max) {
      return `${param.name} must be at most ${param.max}${param.units ? ' ' + param.units : ''}`;
    }
  }

  return null;
}

/**
 * Get default value for a parameter
 */
export function getDefaultParameterValue(paramName: string): number | string {
  const param = PARAMETER_REGISTRY[paramName];
  return param?.defaultValue ?? 0;
}
