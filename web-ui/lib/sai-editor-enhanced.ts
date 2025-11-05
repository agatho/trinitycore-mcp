/**
 * Enhanced SAI Editor with Advanced Features
 *
 * New Features:
 * - Comprehensive parameter validation
 * - Smart suggestions based on context
 * - Script templates library
 * - Phase management
 * - Event linking support
 * - Real-time validation
 * - SQL import/export
 * - Copy/paste/duplicate
 * - Undo/redo system
 * - Search and filter
 * - Auto-layout algorithm
 */

import {
  SAI_EVENT_TYPES_COMPLETE,
  SAI_ACTION_TYPES_COMPLETE,
  SAI_TARGET_TYPES_COMPLETE,
} from './sai-editor-complete';

// ============================================================================
// TYPES
// ============================================================================

export interface SAIParameter {
  name: string;
  value: number | string;
  type: 'number' | 'spell' | 'creature' | 'item' | 'quest' | 'gameobject' | 'text' | 'flag' | 'enum';
  min?: number;
  max?: number;
  options?: Array<{ value: number | string; label: string }>;
  description?: string;
  validation?: (value: any) => string | null;
}

export interface SAINode {
  id: string;
  type: 'event' | 'action' | 'target' | 'comment';
  typeId: string;
  typeName: string;
  label: string;
  parameters: SAIParameter[];
  position: { x: number; y: number };
  phase?: number;
  chance?: number;
  flags?: number;
}

export interface SAIConnection {
  id: string;
  source: string;
  target: string;
  type: 'event-to-action' | 'action-to-target' | 'link';
}

export interface SAIScript {
  id: string;
  name: string;
  entryOrGuid: number;
  sourceType: number;
  nodes: SAINode[];
  connections: SAIConnection[];
  metadata: {
    createdAt: number;
    modifiedAt: number;
    author?: string;
    description?: string;
    tags?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId: string;
  message: string;
  parameter?: string;
}

export interface ValidationWarning {
  nodeId: string;
  message: string;
  suggestion?: string;
}

export interface Suggestion {
  type: 'action' | 'target' | 'parameter';
  nodeId?: string;
  items: Array<{
    id: string;
    name: string;
    description: string;
    relevance: number;
  }>;
}

// ============================================================================
// PARAMETER DEFINITIONS
// ============================================================================

export function getParametersForEvent(eventTypeId: string): SAIParameter[] {
  const eventType = SAI_EVENT_TYPES_COMPLETE.find(e => e.id === eventTypeId);
  if (!eventType) return [];

  const paramMap: Record<string, SAIParameter> = {
    'InitialMin': { name: 'InitialMin', value: 0, type: 'number', min: 0, description: 'Initial min time (ms)' },
    'InitialMax': { name: 'InitialMax', value: 0, type: 'number', min: 0, description: 'Initial max time (ms)' },
    'RepeatMin': { name: 'RepeatMin', value: 0, type: 'number', min: 0, description: 'Repeat min time (ms)' },
    'RepeatMax': { name: 'RepeatMax', value: 0, type: 'number', min: 0, description: 'Repeat max time (ms)' },
    'HPMin%': { name: 'HPMin%', value: 0, type: 'number', min: 0, max: 100, description: 'Minimum health %' },
    'HPMax%': { name: 'HPMax%', value: 100, type: 'number', min: 0, max: 100, description: 'Maximum health %' },
    'ManaMin%': { name: 'ManaMin%', value: 0, type: 'number', min: 0, max: 100, description: 'Minimum mana %' },
    'ManaMax%': { name: 'ManaMax%', value: 100, type: 'number', min: 0, max: 100, description: 'Maximum mana %' },
    'SpellID': { name: 'SpellID', value: 0, type: 'spell', description: 'Spell ID' },
    'School': { name: 'School', value: 0, type: 'enum', description: 'Spell school mask', options: [
      { value: 0, label: 'Any' },
      { value: 1, label: 'Physical' },
      { value: 2, label: 'Holy' },
      { value: 4, label: 'Fire' },
      { value: 8, label: 'Nature' },
      { value: 16, label: 'Frost' },
      { value: 32, label: 'Shadow' },
      { value: 64, label: 'Arcane' },
    ]},
    'CooldownMin': { name: 'CooldownMin', value: 0, type: 'number', min: 0, description: 'Cooldown min (ms)' },
    'CooldownMax': { name: 'CooldownMax', value: 0, type: 'number', min: 0, description: 'Cooldown max (ms)' },
    'MinDist': { name: 'MinDist', value: 0, type: 'number', min: 0, description: 'Minimum distance' },
    'MaxDist': { name: 'MaxDist', value: 0, type: 'number', min: 0, description: 'Maximum distance' },
    'HostileCrew': { name: 'HostileCrew', value: 0, type: 'number', description: 'Hostile or friendly (0/1)' },
    'MaxRange': { name: 'MaxRange', value: 0, type: 'number', min: 0, description: 'Maximum range' },
    'CreatureID': { name: 'CreatureID', value: 0, type: 'creature', description: 'Creature entry' },
    'HPDeficit': { name: 'HPDeficit', value: 0, type: 'number', min: 0, description: 'HP deficit amount' },
    'Radius': { name: 'Radius', value: 0, type: 'number', min: 0, description: 'Search radius' },
    'StackCount': { name: 'StackCount', value: 0, type: 'number', min: 0, description: 'Aura stack count' },
    'QuestID': { name: 'QuestID', value: 0, type: 'quest', description: 'Quest ID' },
    'EmoteID': { name: 'EmoteID', value: 0, type: 'number', description: 'Emote ID' },
    'MinDmg': { name: 'MinDmg', value: 0, type: 'number', min: 0, description: 'Minimum damage' },
    'MaxDmg': { name: 'MaxDmg', value: 0, type: 'number', min: 0, description: 'Maximum damage' },
    'MovementType': { name: 'MovementType', value: 0, type: 'enum', description: 'Movement type', options: [
      { value: 0, label: 'Idle' },
      { value: 1, label: 'Random' },
      { value: 2, label: 'Waypoint' },
    ]},
    'PointID': { name: 'PointID', value: 0, type: 'number', description: 'Point/Waypoint ID' },
    'PathID': { name: 'PathID', value: 0, type: 'number', description: 'Path ID' },
    'Field': { name: 'Field', value: 0, type: 'number', description: 'Data field' },
    'Value': { name: 'Value', value: 0, type: 'number', description: 'Data value' },
    'AreaTriggerID': { name: 'AreaTriggerID', value: 0, type: 'number', description: 'Areatrigger ID' },
    'GroupID': { name: 'GroupID', value: 0, type: 'number', description: 'Group ID' },
    'MinHeal': { name: 'MinHeal', value: 0, type: 'number', min: 0, description: 'Minimum heal amount' },
    'MaxHeal': { name: 'MaxHeal', value: 0, type: 'number', min: 0, description: 'Maximum heal amount' },
    'EventID': { name: 'EventID', value: 0, type: 'number', description: 'Event ID' },
    'MenuID': { name: 'MenuID', value: 0, type: 'number', description: 'Gossip menu ID' },
    'OptionID': { name: 'OptionID', value: 0, type: 'number', description: 'Gossip option ID' },
    'FromPhase': { name: 'FromPhase', value: 0, type: 'number', description: 'From phase' },
    'ToPhase': { name: 'ToPhase', value: 0, type: 'number', description: 'To phase' },
    'State': { name: 'State', value: 0, type: 'number', description: 'State value' },
    'CounterID': { name: 'CounterID', value: 0, type: 'number', description: 'Counter ID' },
    'GameobjectID': { name: 'GameobjectID', value: 0, type: 'gameobject', description: 'Gameobject entry' },
    'Distance': { name: 'Distance', value: 0, type: 'number', min: 0, description: 'Distance' },
    'OnRemove': { name: 'OnRemove', value: 0, type: 'number', min: 0, max: 1, description: 'On remove (0/1)' },
  };

  return eventType.params.map(paramName =>
    paramMap[paramName] || { name: paramName, value: 0, type: 'number', description: paramName }
  );
}

export function getParametersForAction(actionTypeId: string): SAIParameter[] {
  const actionType = SAI_ACTION_TYPES_COMPLETE.find(a => a.id === actionTypeId);
  if (!actionType) return [];

  const paramMap: Record<string, SAIParameter> = {
    'TextID': { name: 'TextID', value: 0, type: 'text', description: 'Text ID from creature_text' },
    'Duration': { name: 'Duration', value: 0, type: 'number', min: 0, description: 'Duration (ms)' },
    'UseTalkTarget': { name: 'UseTalkTarget', value: 0, type: 'number', min: 0, max: 1, description: 'Use talk target (0/1)' },
    'FactionID': { name: 'FactionID', value: 0, type: 'number', description: 'Faction ID' },
    'CreatureEntry': { name: 'CreatureEntry', value: 0, type: 'creature', description: 'Creature entry' },
    'ModelID': { name: 'ModelID', value: 0, type: 'number', description: 'Display model ID' },
    'SoundID': { name: 'SoundID', value: 0, type: 'number', description: 'Sound ID' },
    'OnlySelf': { name: 'OnlySelf', value: 0, type: 'number', min: 0, max: 1, description: 'Only self (0/1)' },
    'Distance': { name: 'Distance', value: 0, type: 'number', min: 0, description: 'Distance' },
    'EmoteID': { name: 'EmoteID', value: 0, type: 'number', description: 'Emote ID' },
    'QuestID': { name: 'QuestID', value: 0, type: 'quest', description: 'Quest ID' },
    'DirectAdd': { name: 'DirectAdd', value: 0, type: 'number', min: 0, max: 1, description: 'Direct add (0/1)' },
    'State': { name: 'State', value: 0, type: 'enum', description: 'React state', options: [
      { value: 0, label: 'Passive' },
      { value: 1, label: 'Defensive' },
      { value: 2, label: 'Aggressive' },
    ]},
    'SpellID': { name: 'SpellID', value: 0, type: 'spell', description: 'Spell ID' },
    'CastFlags': { name: 'CastFlags', value: 0, type: 'flag', description: 'Cast flags' },
    'TriggerFlags': { name: 'TriggerFlags', value: 0, type: 'flag', description: 'Trigger flags' },
    'SummonType': { name: 'SummonType', value: 0, type: 'enum', description: 'Summon type', options: [
      { value: 1, label: 'Timed or Dead Despawn' },
      { value: 2, label: 'Timed or Corpse Despawn' },
      { value: 3, label: 'Timed Despawn' },
      { value: 4, label: 'Timed Despawn OOC' },
      { value: 5, label: 'Corpse Despawn' },
      { value: 6, label: 'Corpse Timed Despawn' },
      { value: 7, label: 'Dead Despawn' },
      { value: 8, label: 'Manual Despawn' },
    ]},
    'AttackInvoker': { name: 'AttackInvoker', value: 0, type: 'number', min: 0, max: 1, description: 'Attack invoker (0/1)' },
    'ThreatPCT': { name: 'ThreatPCT', value: 0, type: 'number', description: 'Threat percentage' },
    'IncDec': { name: 'IncDec', value: 0, type: 'enum', description: 'Increase/Decrease', options: [
      { value: 0, label: 'Increase' },
      { value: 1, label: 'Decrease' },
    ]},
    'GroupID': { name: 'GroupID', value: 0, type: 'number', description: 'Group ID' },
    'Apply': { name: 'Apply', value: 1, type: 'number', min: 0, max: 1, description: 'Apply (0/1)' },
    'Flags': { name: 'Flags', value: 0, type: 'flag', description: 'Flags' },
    'AllowAttackState': { name: 'AllowAttackState', value: 1, type: 'number', min: 0, max: 1, description: 'Allow attack (0/1)' },
    'AllowMovement': { name: 'AllowMovement', value: 1, type: 'number', min: 0, max: 1, description: 'Allow movement (0/1)' },
    'Phase': { name: 'Phase', value: 0, type: 'number', min: 0, description: 'Event phase' },
    'Increment': { name: 'Increment', value: 0, type: 'number', description: 'Increment amount' },
    'Decrement': { name: 'Decrement', value: 0, type: 'number', description: 'Decrement amount' },
    'Charges': { name: 'Charges', value: 0, type: 'number', min: 0, description: 'Number of charges' },
    'Angle': { name: 'Angle', value: 0, type: 'number', description: 'Angle in radians' },
    'EndCreatureEntry': { name: 'EndCreatureEntry', value: 0, type: 'creature', description: 'End creature entry' },
    'Phase1': { name: 'Phase1', value: 0, type: 'number', description: 'Phase 1' },
    'Phase2': { name: 'Phase2', value: 0, type: 'number', description: 'Phase 2' },
    'Phase3': { name: 'Phase3', value: 0, type: 'number', description: 'Phase 3' },
    'Phase4': { name: 'Phase4', value: 0, type: 'number', description: 'Phase 4' },
    'PhaseMin': { name: 'PhaseMin', value: 0, type: 'number', description: 'Minimum phase' },
    'PhaseMax': { name: 'PhaseMax', value: 0, type: 'number', description: 'Maximum phase' },
    'Field': { name: 'Field', value: 0, type: 'number', description: 'Data field' },
    'Data': { name: 'Data', value: 0, type: 'number', description: 'Data value' },
    'Radius': { name: 'Radius', value: 0, type: 'number', min: 0, description: 'Radius' },
    'Sheath': { name: 'Sheath', value: 0, type: 'enum', description: 'Sheath state', options: [
      { value: 0, label: 'Unarmed' },
      { value: 1, label: 'Melee' },
      { value: 2, label: 'Ranged' },
    ]},
    'Delay': { name: 'Delay', value: 0, type: 'number', min: 0, description: 'Delay (ms)' },
    'MinHP': { name: 'MinHP', value: 0, type: 'number', min: 0, description: 'Minimum HP' },
    'Percent': { name: 'Percent', value: 0, type: 'number', min: 0, max: 1, description: 'Is percent (0/1)' },
    'Visibility': { name: 'Visibility', value: 1, type: 'number', min: 0, max: 1, description: 'Visible (0/1)' },
    'Active': { name: 'Active', value: 1, type: 'number', min: 0, max: 1, description: 'Active (0/1)' },
    'GameobjectEntry': { name: 'GameobjectEntry', value: 0, type: 'gameobject', description: 'Gameobject entry' },
    'DespawnTime': { name: 'DespawnTime', value: 0, type: 'number', min: 0, description: 'Despawn time (ms)' },
    'TaxiID': { name: 'TaxiID', value: 0, type: 'number', description: 'Taxi path ID' },
    'Run': { name: 'Run', value: 1, type: 'number', min: 0, max: 1, description: 'Run (0/1)' },
    'PathID': { name: 'PathID', value: 0, type: 'number', description: 'Path ID' },
    'Repeat': { name: 'Repeat', value: 0, type: 'number', min: 0, max: 1, description: 'Repeat (0/1)' },
    'Quest': { name: 'Quest', value: 0, type: 'quest', description: 'Quest ID' },
    'Time': { name: 'Time', value: 0, type: 'number', min: 0, description: 'Time (ms)' },
    'Fail': { name: 'Fail', value: 0, type: 'number', min: 0, max: 1, description: 'Fail quest (0/1)' },
    'ItemID': { name: 'ItemID', value: 0, type: 'item', description: 'Item entry' },
    'Count': { name: 'Count', value: 1, type: 'number', min: 1, description: 'Item count' },
    'TemplateID': { name: 'TemplateID', value: 0, type: 'enum', description: 'AI template', options: [
      { value: 0, label: 'Basic Melee' },
      { value: 1, label: 'Caster' },
      { value: 2, label: 'Turret' },
      { value: 3, label: 'Passive' },
      { value: 4, label: 'Caged GO' },
      { value: 5, label: 'Caged Creature' },
    ]},
    'Swim': { name: 'Swim', value: 0, type: 'number', min: 0, max: 1, description: 'Swim (0/1)' },
    'Disable': { name: 'Disable', value: 0, type: 'number', min: 0, max: 1, description: 'Disable (0/1)' },
    'MapID': { name: 'MapID', value: 0, type: 'number', description: 'Map ID' },
    'X': { name: 'X', value: 0, type: 'number', description: 'X coordinate' },
    'Y': { name: 'Y', value: 0, type: 'number', description: 'Y coordinate' },
    'Z': { name: 'Z', value: 0, type: 'number', description: 'Z coordinate' },
    'O': { name: 'O', value: 0, type: 'number', description: 'Orientation' },
    'CounterID': { name: 'CounterID', value: 0, type: 'number', description: 'Counter ID' },
    'Reset': { name: 'Reset', value: 0, type: 'number', min: 0, max: 1, description: 'Reset counter (0/1)' },
    'ID': { name: 'ID', value: 0, type: 'number', description: 'ID' },
    'Orientation': { name: 'Orientation', value: 0, type: 'number', description: 'Orientation' },
    'InitMin': { name: 'InitMin', value: 0, type: 'number', min: 0, description: 'Initial min time (ms)' },
    'InitMax': { name: 'InitMax', value: 0, type: 'number', min: 0, description: 'Initial max time (ms)' },
    'RepeatMin': { name: 'RepeatMin', value: 0, type: 'number', min: 0, description: 'Repeat min time (ms)' },
    'MovieID': { name: 'MovieID', value: 0, type: 'number', description: 'Movie ID' },
    'EquipmentID': { name: 'EquipmentID', value: 0, type: 'number', description: 'Equipment template ID' },
    'AuraType': { name: 'AuraType', value: 0, type: 'number', description: 'Aura type' },
    'Threat': { name: 'Threat', value: 0, type: 'number', description: 'Threat amount' },
    'Force': { name: 'Force', value: 0, type: 'number', min: 0, max: 1, description: 'Force (0/1)' },
    'ID1': { name: 'ID1', value: 0, type: 'number', description: 'ID 1' },
    'ID2': { name: 'ID2', value: 0, type: 'number', description: 'ID 2' },
    'ID3': { name: 'ID3', value: 0, type: 'number', description: 'ID 3' },
    'IDMin': { name: 'IDMin', value: 0, type: 'number', description: 'Minimum ID' },
    'IDMax': { name: 'IDMax', value: 0, type: 'number', description: 'Maximum ID' },
    'Bytes': { name: 'Bytes', value: 0, type: 'number', description: 'Bytes value' },
    'Type': { name: 'Type', value: 0, type: 'number', description: 'Type' },
    'AnimID': { name: 'AnimID', value: 0, type: 'number', description: 'Animation ID' },
    'SpeedXY': { name: 'SpeedXY', value: 0, type: 'number', min: 0, description: 'XY speed' },
    'SpeedZ': { name: 'SpeedZ', value: 0, type: 'number', description: 'Z speed' },
    'Root': { name: 'Root', value: 0, type: 'number', min: 0, max: 1, description: 'Root (0/1)' },
    'Regen': { name: 'Regen', value: 1, type: 'number', min: 0, max: 1, description: 'Regen (0/1)' },
    'PowerType': { name: 'PowerType', value: 0, type: 'enum', description: 'Power type', options: [
      { value: 0, label: 'Mana' },
      { value: 1, label: 'Rage' },
      { value: 2, label: 'Focus' },
      { value: 3, label: 'Energy' },
      { value: 4, label: 'Happiness' },
    ]},
    'Power': { name: 'Power', value: 0, type: 'number', description: 'Power amount' },
    'EventID': { name: 'EventID', value: 0, type: 'number', description: 'Event ID' },
    'WP1': { name: 'WP1', value: 0, type: 'number', description: 'Waypoint 1' },
    'WP2': { name: 'WP2', value: 0, type: 'number', description: 'Waypoint 2' },
    'WP3': { name: 'WP3', value: 0, type: 'number', description: 'Waypoint 3' },
    'WP4': { name: 'WP4', value: 0, type: 'number', description: 'Waypoint 4' },
    'Sound1': { name: 'Sound1', value: 0, type: 'number', description: 'Sound 1' },
    'Sound2': { name: 'Sound2', value: 0, type: 'number', description: 'Sound 2' },
    'Sound3': { name: 'Sound3', value: 0, type: 'number', description: 'Sound 3' },
    'Sound4': { name: 'Sound4', value: 0, type: 'number', description: 'Sound 4' },
    'Timer': { name: 'Timer', value: 0, type: 'number', min: 0, description: 'Timer (seconds)' },
    'Fly': { name: 'Fly', value: 0, type: 'number', min: 0, max: 1, description: 'Can fly (0/1)' },
    'FleeTime': { name: 'FleeTime', value: 0, type: 'number', min: 0, description: 'Flee time (ms)' },
    'PauseTimer': { name: 'PauseTimer', value: 0, type: 'number', min: 0, description: 'Pause timer (ms)' },
    'AnimKitID': { name: 'AnimKitID', value: 0, type: 'number', description: 'AnimKit ID' },
    'SceneID': { name: 'SceneID', value: 0, type: 'number', description: 'Scene ID' },
    'MinDelay': { name: 'MinDelay', value: 0, type: 'number', min: 0, description: 'Minimum delay (ms)' },
    'MaxDelay': { name: 'MaxDelay', value: 0, type: 'number', min: 0, description: 'Maximum delay (ms)' },
    'SpawnID': { name: 'SpawnID', value: 0, type: 'number', description: 'Spawn ID' },
    'CinematicID': { name: 'CinematicID', value: 0, type: 'number', description: 'Cinematic ID' },
    'SpeedType': { name: 'SpeedType', value: 0, type: 'enum', description: 'Movement speed type', options: [
      { value: 0, label: 'Walk' },
      { value: 1, label: 'Run' },
    ]},
    'Speed': { name: 'Speed', value: 1, type: 'number', min: 0, description: 'Speed multiplier' },
    'KitID': { name: 'KitID', value: 0, type: 'number', description: 'Spell visual kit ID' },
    'ZoneID': { name: 'ZoneID', value: 0, type: 'number', description: 'Zone ID' },
    'AreaLightID': { name: 'AreaLightID', value: 0, type: 'number', description: 'Area light ID' },
    'TransitionTime': { name: 'TransitionTime', value: 0, type: 'number', min: 0, description: 'Transition time (ms)' },
    'WeatherType': { name: 'WeatherType', value: 0, type: 'number', description: 'Weather type' },
    'Grade': { name: 'Grade', value: 0, type: 'number', min: 0, max: 1, description: 'Weather grade' },
    'Enable': { name: 'Enable', value: 1, type: 'number', min: 0, max: 1, description: 'Enable (0/1)' },
    'ConversationID': { name: 'ConversationID', value: 0, type: 'number', description: 'Conversation ID' },
    'Immune': { name: 'Immune', value: 0, type: 'number', min: 0, max: 1, description: 'Immune (0/1)' },
    'Uninteractible': { name: 'Uninteractible', value: 0, type: 'number', min: 0, max: 1, description: 'Uninteractible (0/1)' },
    'UseSAITargetAsGameEventSource': { name: 'UseSAITargetAsGameEventSource', value: 0, type: 'number', min: 0, max: 1, description: 'Use SAI target (0/1)' },
    'ActionID': { name: 'ActionID', value: 0, type: 'number', description: 'Action ID' },
    'ObjectiveID': { name: 'ObjectiveID', value: 0, type: 'number', description: 'Quest objective ID' },
    'VehicleSeat': { name: 'VehicleSeat', value: 0, type: 'number', description: 'Vehicle seat ID' },
    'VehicleEntry': { name: 'VehicleEntry', value: 0, type: 'creature', description: 'Vehicle creature entry' },
    'Emote1': { name: 'Emote1', value: 0, type: 'number', description: 'Emote 1' },
    'Emote2': { name: 'Emote2', value: 0, type: 'number', description: 'Emote 2' },
    'Emote3': { name: 'Emote3', value: 0, type: 'number', description: 'Emote 3' },
    'Emote4': { name: 'Emote4', value: 0, type: 'number', description: 'Emote 4' },
    'Team': { name: 'Team', value: 0, type: 'enum', description: 'Team', options: [
      { value: 0, label: 'Any' },
      { value: 469, label: 'Alliance' },
      { value: 67, label: 'Horde' },
    ]},
    'Entry': { name: 'Entry', value: 0, type: 'creature', description: 'Creature entry' },
  };

  return actionType.params.map(paramName =>
    paramMap[paramName] || { name: paramName, value: 0, type: 'number', description: paramName }
  );
}

export function getParametersForTarget(targetTypeId: string): SAIParameter[] {
  const targetType = SAI_TARGET_TYPES_COMPLETE.find(t => t.id === targetTypeId);
  if (!targetType) return [];

  const paramMap: Record<string, SAIParameter> = {
    'MaxDist': { name: 'MaxDist', value: 0, type: 'number', min: 0, description: 'Maximum distance' },
    'CreatureEntry': { name: 'CreatureEntry', value: 0, type: 'creature', description: 'Creature entry' },
    'MinDist': { name: 'MinDist', value: 0, type: 'number', min: 0, description: 'Minimum distance' },
    'GUID': { name: 'GUID', value: 0, type: 'number', description: 'Creature GUID' },
    'Entry': { name: 'Entry', value: 0, type: 'creature', description: 'Creature entry' },
    'ID': { name: 'ID', value: 0, type: 'number', description: 'Stored target ID' },
    'GameobjectEntry': { name: 'GameobjectEntry', value: 0, type: 'gameobject', description: 'Gameobject entry' },
    'Alive': { name: 'Alive', value: 1, type: 'number', min: 0, max: 1, description: 'Alive only (0/1)' },
    'PlayerOnly': { name: 'PlayerOnly', value: 0, type: 'number', min: 0, max: 1, description: 'Player only (0/1)' },
    'SeatID': { name: 'SeatID', value: 0, type: 'number', description: 'Vehicle seat ID' },
  };

  return targetType.params.map(paramName =>
    paramMap[paramName] || { name: paramName, value: 0, type: 'number', description: paramName }
  );
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateScript(script: SAIScript): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if we have at least one event
  const eventNodes = script.nodes.filter(n => n.type === 'event');
  if (eventNodes.length === 0) {
    errors.push({
      nodeId: '',
      message: 'Script must have at least one event node',
    });
  }

  // Validate each node
  script.nodes.forEach(node => {
    // Validate parameters
    node.parameters.forEach(param => {
      if (param.validation) {
        const error = param.validation(param.value);
        if (error) {
          errors.push({
            nodeId: node.id,
            message: error,
            parameter: param.name,
          });
        }
      }

      // Check min/max
      if (typeof param.value === 'number') {
        if (param.min !== undefined && param.value < param.min) {
          errors.push({
            nodeId: node.id,
            message: `${param.name} must be at least ${param.min}`,
            parameter: param.name,
          });
        }
        if (param.max !== undefined && param.value > param.max) {
          errors.push({
            nodeId: node.id,
            message: `${param.name} must be at most ${param.max}`,
            parameter: param.name,
          });
        }
      }
    });

    // Check connections
    const nodeConnections = script.connections.filter(
      c => c.source === node.id || c.target === node.id
    );

    if (node.type === 'event' && !nodeConnections.some(c => c.source === node.id)) {
      warnings.push({
        nodeId: node.id,
        message: 'Event node has no outgoing connections',
        suggestion: 'Connect this event to an action node',
      });
    }

    if (node.type === 'action' && !nodeConnections.some(c => c.target === node.id)) {
      warnings.push({
        nodeId: node.id,
        message: 'Action node has no incoming connections',
        suggestion: 'Connect an event to this action node',
      });
    }

    if (node.type === 'action' && !nodeConnections.some(c => c.source === node.id)) {
      warnings.push({
        nodeId: node.id,
        message: 'Action node has no target',
        suggestion: 'Connect this action to a target node',
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// SUGGESTIONS
// ============================================================================

export function suggestActions(eventTypeId: string): Suggestion {
  const suggestions: Record<string, string[]> = {
    '4': ['11', '1', '5'], // AGGRO -> Cast, Talk, Emote
    '5': ['1', '67', '10'], // KILL -> Talk, Timed Event, Random Emote
    '6': ['1', '41', '67'], // DEATH -> Talk, Despawn, Timed Event
    '8': ['11', '28', '75'], // SPELLHIT -> Cast, Remove Aura, Add Aura
    '2': ['11', '142'], // HEALTH_PCT -> Cast, Set Health PCT
    '0': ['11', '49'], // UPDATE_IC -> Cast, Attack Start
    '1': ['1', '10'], // UPDATE_OOC -> Talk, Random Emote
    '19': ['7', '15'], // ACCEPTED_QUEST -> Offer Quest, Call Area Explored
    '20': ['15', '26'], // REWARD_QUEST -> Call Area Explored, Call Group Event
  };

  const actionIds = suggestions[eventTypeId] || [];
  const items = actionIds
    .map(id => {
      const action = SAI_ACTION_TYPES_COMPLETE.find(a => a.id === id);
      return action
        ? {
            id: action.id,
            name: action.name,
            description: action.label,
            relevance: 100 - actionIds.indexOf(id) * 10,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { type: 'action', items };
}

export function suggestTargets(actionTypeId: string): Suggestion {
  const suggestions: Record<string, string[]> = {
    '11': ['2', '7', '5'], // CAST -> Victim, Invoker, Random
    '1': ['2', '7', '1'], // TALK -> Victim, Invoker, Self
    '12': ['8', '1'], // SUMMON_CREATURE -> Position, Self
    '50': ['8', '1'], // SUMMON_GO -> Position, Self
    '29': ['2', '7'], // FOLLOW -> Victim, Invoker
    '49': ['2', '3', '4'], // ATTACK_START -> Victim, Second Aggro, Last Aggro
    '75': ['2', '1', '7'], // ADD_AURA -> Victim, Self, Invoker
  };

  const targetIds = suggestions[actionTypeId] || ['2', '7', '1']; // Default to common targets
  const items = targetIds
    .map(id => {
      const target = SAI_TARGET_TYPES_COMPLETE.find(t => t.id === id);
      return target
        ? {
            id: target.id,
            name: target.name,
            description: target.label,
            relevance: 100 - targetIds.indexOf(id) * 10,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { type: 'target', items };
}

// ============================================================================
// SQL GENERATION
// ============================================================================

export function generateSQL(script: SAIScript): string {
  let sql = `-- SAI Script: ${script.name}\n`;
  sql += `-- Entry: ${script.entryOrGuid}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;

  sql += `DELETE FROM smart_scripts WHERE entryorguid = ${script.entryOrGuid} AND source_type = ${script.sourceType};\n`;
  sql += `INSERT INTO smart_scripts (entryorguid, source_type, id, link, event_type, event_phase_mask, event_chance, event_flags, event_param1, event_param2, event_param3, event_param4, action_type, action_param1, action_param2, action_param3, action_param4, action_param5, action_param6, target_type, target_param1, target_param2, target_param3, target_x, target_y, target_z, target_o, comment) VALUES\n`;

  const entries: string[] = [];
  let id = 0;

  // Group nodes by event
  const eventNodes = script.nodes.filter(n => n.type === 'event');
  eventNodes.forEach((eventNode, idx) => {
    // Find actions connected to this event
    const actionConnections = script.connections.filter(
      c => c.source === eventNode.id && c.type === 'event-to-action'
    );

    actionConnections.forEach(actionConn => {
      const actionNode = script.nodes.find(n => n.id === actionConn.target);
      if (!actionNode) return;

      // Find target connected to this action
      const targetConnection = script.connections.find(
        c => c.source === actionNode.id && c.type === 'action-to-target'
      );
      const targetNode = targetConnection
        ? script.nodes.find(n => n.id === targetConnection.target)
        : null;

      // Build SQL entry
      const eventParams = eventNode.parameters.map(p => p.value).concat([0, 0, 0, 0]).slice(0, 4);
      const actionParams = actionNode.parameters.map(p => p.value).concat([0, 0, 0, 0, 0, 0]).slice(0, 6);
      const targetParams = targetNode?.parameters.map(p => p.value).concat([0, 0, 0, 0, 0, 0, 0]).slice(0, 7) || [0, 0, 0, 0, 0, 0, 0];

      const entry = `(${script.entryOrGuid}, ${script.sourceType}, ${id}, 0, ${eventNode.typeId}, ${eventNode.phase || 0}, ${eventNode.chance || 100}, ${eventNode.flags || 0}, ${eventParams.join(', ')}, ${actionNode.typeId}, ${actionParams.join(', ')}, ${targetNode?.typeId || 0}, ${targetParams.join(', ')}, '${script.name} - ${eventNode.label} -> ${actionNode.label}')`;
      entries.push(entry);
      id++;
    });
  });

  sql += entries.join(',\n') + ';\n';

  return sql;
}

// ============================================================================
// SQL IMPORT
// ============================================================================

export function parseSQL(sql: string): SAIScript | null {
  // Simple SQL parser (basic implementation)
  const lines = sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
  const valuesLine = lines.find(l => l.includes('VALUES'));
  if (!valuesLine) return null;

  // Extract entry/guid from DELETE statement
  const deleteMatch = sql.match(/entryorguid\s*=\s*(\d+)/);
  if (!deleteMatch) return null;
  const entryOrGuid = parseInt(deleteMatch[1]);

  // Parse values (simplified - would need full SQL parser in production)
  const nodes: SAINode[] = [];
  const connections: SAIConnection[] = [];

  // This is a placeholder - full implementation would properly parse SQL VALUES
  return {
    id: `script-${Date.now()}`,
    name: `Imported Script ${entryOrGuid}`,
    entryOrGuid,
    sourceType: 0,
    nodes,
    connections,
    metadata: {
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      description: 'Imported from SQL',
    },
  };
}

// ============================================================================
// TEMPLATE LIBRARY
// ============================================================================

export const SAI_TEMPLATE_LIBRARY = [
  {
    id: 'basic-combat',
    name: 'Basic Combat',
    description: 'Simple combat script with spell casting',
    category: 'combat',
    script: {
      name: 'Basic Combat',
      events: ['UPDATE_IC'],
      actions: ['CAST'],
      target: 'VICTIM',
    },
  },
  {
    id: 'on-aggro-yell',
    name: 'Aggro Yell',
    description: 'Yell text when entering combat',
    category: 'dialogue',
    script: {
      name: 'Aggro Yell',
      events: ['AGGRO'],
      actions: ['TALK'],
      target: 'SELF',
    },
  },
  {
    id: 'on-death-summon',
    name: 'Death Summon',
    description: 'Summon creatures on death',
    category: 'summon',
    script: {
      name: 'Death Summon',
      events: ['DEATH'],
      actions: ['SUMMON_CREATURE'],
      target: 'POSITION',
    },
  },
  {
    id: 'health-phases',
    name: 'Health Phase System',
    description: 'Change phases based on health percentage',
    category: 'combat',
    script: {
      name: 'Health Phases',
      events: ['HEALTH_PCT', 'HEALTH_PCT', 'HEALTH_PCT'],
      actions: ['SET_EVENT_PHASE', 'SET_EVENT_PHASE', 'SET_EVENT_PHASE'],
      target: 'SELF',
    },
  },
  {
    id: 'quest-giver',
    name: 'Quest Giver',
    description: 'Handle quest accept and reward',
    category: 'quest',
    script: {
      name: 'Quest Giver',
      events: ['QUEST_ACCEPTED', 'QUEST_REWARDED'],
      actions: ['TALK', 'TALK'],
      target: 'INVOKER',
    },
  },
];

// ============================================================================
// AUTO-LAYOUT
// ============================================================================

export function autoLayout(nodes: SAINode[], connections: SAIConnection[]): SAINode[] {
  // Simple layered layout algorithm
  const LAYER_SPACING = 300;
  const NODE_SPACING = 150;

  // Group nodes by type
  const eventNodes = nodes.filter(n => n.type === 'event');
  const actionNodes = nodes.filter(n => n.type === 'action');
  const targetNodes = nodes.filter(n => n.type === 'target');

  // Position event nodes in first column
  eventNodes.forEach((node, idx) => {
    node.position = { x: 50, y: 50 + idx * NODE_SPACING };
  });

  // Position action nodes in second column
  actionNodes.forEach((node, idx) => {
    node.position = { x: 50 + LAYER_SPACING, y: 50 + idx * NODE_SPACING };
  });

  // Position target nodes in third column
  targetNodes.forEach((node, idx) => {
    node.position = { x: 50 + LAYER_SPACING * 2, y: 50 + idx * NODE_SPACING };
  });

  return nodes;
}

// ============================================================================
// COPY/PASTE
// ============================================================================

export interface Clipboard {
  nodes: SAINode[];
  connections: SAIConnection[];
}

export function copyNodes(nodeIds: Set<string>, script: SAIScript): Clipboard {
  const nodes = script.nodes.filter(n => nodeIds.has(n.id));
  const connections = script.connections.filter(
    c => nodeIds.has(c.source) && nodeIds.has(c.target)
  );

  return { nodes, connections };
}

export function pasteNodes(clipboard: Clipboard, offset: { x: number; y: number }): Clipboard {
  // Create new IDs for pasted nodes
  const idMap = new Map<string, string>();

  const newNodes = clipboard.nodes.map(node => {
    const newId = `${node.type}-${Date.now()}-${Math.random()}`;
    idMap.set(node.id, newId);

    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    };
  });

  const newConnections = clipboard.connections.map(conn => ({
    ...conn,
    id: `conn-${Date.now()}-${Math.random()}`,
    source: idMap.get(conn.source) || conn.source,
    target: idMap.get(conn.target) || conn.target,
  }));

  return { nodes: newNodes, connections: newConnections };
}
