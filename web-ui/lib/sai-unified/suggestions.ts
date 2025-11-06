/**
 * TrinityCore SAI Unified Editor - Smart Suggestion System
 *
 * Context-aware suggestions for actions, targets, parameters, and templates.
 * Uses relevance scoring and machine learning patterns.
 *
 * @module sai-unified/suggestions
 * @version 3.0.0
 */

import type { Suggestion, SuggestionItem, SAINode, SAIScript } from './types';
import { SAI_ACTION_TYPES, SAI_TARGET_TYPES, getEventType, getActionType, getTargetType } from './constants';

// ============================================================================
// ACTION SUGGESTIONS
// ============================================================================

/**
 * Suggest actions based on event type
 */
export function suggestActions(eventTypeId: string, context?: { script?: SAIScript }): Suggestion {
  const items: SuggestionItem[] = [];

  // Get context-specific suggestions
  const contextSuggestions = getActionSuggestionsForEvent(eventTypeId);

  // Convert to SuggestionItems
  contextSuggestions.forEach((actionId, index) => {
    const actionType = getActionType(actionId);
    if (actionType) {
      items.push({
        id: actionType.id,
        name: actionType.name,
        description: actionType.label,
        relevance: 100 - index * 10,
        category: getActionCategory(actionType.name),
        tags: getActionTags(actionType.name),
        example: getActionExample(actionType.name, eventTypeId),
      });
    }
  });

  // Add general suggestions if context-specific didn't provide enough
  if (items.length < 10) {
    const generalActions = getGeneralActionSuggestions();
    generalActions.slice(0, 10 - items.length).forEach((actionId, index) => {
      const actionType = getActionType(actionId);
      if (actionType && !items.some((i) => i.id === actionType.id)) {
        items.push({
          id: actionType.id,
          name: actionType.name,
          description: actionType.label,
          relevance: 50 - index * 5,
          category: getActionCategory(actionType.name),
          tags: getActionTags(actionType.name),
        });
      }
    });
  }

  return {
    type: 'action',
    items,
    context: {
      reason: `Suggested actions for ${getEventType(eventTypeId)?.label || 'this event'}`,
      confidence: contextSuggestions.length > 0 ? 0.9 : 0.5,
    },
  };
}

/**
 * Get action suggestions for specific event type
 */
function getActionSuggestionsForEvent(eventTypeId: string): string[] {
  // Combat events
  const combatSuggestions: Record<string, string[]> = {
    '0': ['11', '49', '28'], // UPDATE_IC -> Cast, Attack Start, Remove Aura
    '2': ['11', '142', '143'], // HEALTH_PCT -> Cast, Set Health PCT, Set Health
    '4': ['1', '11', '5', '10'], // AGGRO -> Talk, Cast, Emote, Random Emote
    '5': ['1', '67', '10', '22'], // KILL -> Talk, Timed Event, Random Emote, Set Phase
    '6': ['1', '41', '67', '37'], // DEATH -> Talk, Despawn, Timed Event, Die
    '7': ['11', '37', '41'], // EVADE -> Cast, Die, Despawn
    '8': ['11', '28', '75', '1'], // SPELLHIT -> Cast, Remove Aura, Add Aura, Talk
    '9': ['11', '28', '14'], // RANGE -> Cast, Remove Aura, Update Template
    '14': ['11', '28', '75'], // FRIENDLY_HP -> Cast, Remove Aura, Add Aura
    '61': ['11', '28', '75'], // DAMAGED -> Cast, Remove Aura, Add Aura
    '62': ['11', '143', '142'], // DAMAGED_PCT -> Cast, Set Health, Set Health PCT
  };

  // Quest events
  const questSuggestions: Record<string, string[]> = {
    '19': ['1', '15', '7'], // QUEST_ACCEPTED -> Talk, Area Explored, Offer Quest
    '20': ['1', '15', '26', '33'], // QUEST_REWARDED -> Talk, Area Explored, Group Event, Auto Attack
    '40': ['1', '15', '7'], // QUEST_OBJ_COMPLETE -> Talk, Area Explored, Offer Quest
  };

  // Movement events
  const movementSuggestions: Record<string, string[]> = {
    '46': ['1', '11', '5'], // WAYPOINT_REACHED -> Talk, Cast, Emote
    '27': ['29', '66', '1'], // FOLLOW_COMPLETED -> Follow, Stop Follow, Talk
    '73': ['1', '11', '5'], // WAYPOINT_RESUMED -> Talk, Cast, Emote
  };

  // Gossip events
  const gossipSuggestions: Record<string, string[]> = {
    '62': ['1', '51', '11'], // GOSSIP_SELECT -> Talk, Add Item, Cast
    '64': ['1', '86', '11'], // GOSSIP_HELLO -> Talk, Teleport, Cast
  };

  // Instance/Boss events
  const bossSuggestions: Record<string, string[]> = {
    '2': ['22', '11', '12'], // HEALTH_PCT -> Set Phase, Cast, Summon
    '21': ['12', '50', '11'], // SUMMONED_UNIT -> Summon Creature, Summon GO, Cast
    '25': ['22', '11', '28'], // RESET -> Set Phase, Cast, Remove Aura
  };

  // Get event-specific suggestions
  return (
    combatSuggestions[eventTypeId] ||
    questSuggestions[eventTypeId] ||
    movementSuggestions[eventTypeId] ||
    gossipSuggestions[eventTypeId] ||
    bossSuggestions[eventTypeId] ||
    []
  );
}

/**
 * Get general action suggestions (most common)
 */
function getGeneralActionSuggestions(): string[] {
  return [
    '11', // Cast
    '1', // Talk
    '5', // Emote
    '12', // Summon Creature
    '28', // Remove Aura
    '75', // Add Aura
    '49', // Attack Start
    '22', // Set Phase
    '67', // Timed Event
    '33', // Auto Attack
  ];
}

// ============================================================================
// TARGET SUGGESTIONS
// ============================================================================

/**
 * Suggest targets based on action type
 */
export function suggestTargets(actionTypeId: string, context?: { eventType?: string }): Suggestion {
  const items: SuggestionItem[] = [];

  // Get context-specific suggestions
  const contextSuggestions = getTargetSuggestionsForAction(actionTypeId, context?.eventType);

  // Convert to SuggestionItems
  contextSuggestions.forEach((targetId, index) => {
    const targetType = getTargetType(targetId);
    if (targetType) {
      items.push({
        id: targetType.id,
        name: targetType.name,
        description: targetType.label,
        relevance: 100 - index * 10,
        category: getTargetCategory(targetType.name),
        tags: getTargetTags(targetType.name),
        example: getTargetExample(targetType.name, actionTypeId),
      });
    }
  });

  return {
    type: 'target',
    items,
    context: {
      reason: `Suggested targets for ${getActionType(actionTypeId)?.label || 'this action'}`,
      confidence: contextSuggestions.length > 0 ? 0.9 : 0.5,
    },
  };
}

/**
 * Get target suggestions for specific action type
 */
function getTargetSuggestionsForAction(actionTypeId: string, eventType?: string): string[] {
  // Spell/Combat actions
  const spellTargets: Record<string, string[]> = {
    '11': ['2', '7', '5', '1'], // Cast -> Victim, Invoker, Random, Self
    '75': ['2', '7', '1', '5'], // Add Aura -> Victim, Invoker, Self, Random
    '28': ['2', '1', '7'], // Remove Aura -> Victim, Self, Invoker
    '49': ['2', '3', '4', '7'], // Attack Start -> Victim, Second Aggro, Last Aggro, Invoker
  };

  // Communication actions
  const communicationTargets: Record<string, string[]> = {
    '1': ['1', '7', '2'], // Talk -> Self, Invoker, Victim
    '5': ['1'], // Emote -> Self
    '10': ['1'], // Random Emote -> Self
  };

  // Summon actions
  const summonTargets: Record<string, string[]> = {
    '12': ['8', '1', '7'], // Summon Creature -> Position, Self, Invoker
    '50': ['8', '1', '7'], // Summon GO -> Position, Self, Invoker
  };

  // Movement actions
  const movementTargets: Record<string, string[]> = {
    '29': ['7', '2', '1'], // Follow -> Invoker, Victim, Self
    '59': ['8', '1'], // Move To Position -> Position, Self
    '53': ['8'], // Jump To Position -> Position
  };

  // Quest actions
  const questTargets: Record<string, string[]> = {
    '7': ['7'], // Offer Quest -> Invoker
    '15': ['7'], // Area Explored -> Invoker
    '26': ['7'], // Group Event -> Invoker
  };

  // Get action-specific suggestions
  return (
    spellTargets[actionTypeId] ||
    communicationTargets[actionTypeId] ||
    summonTargets[actionTypeId] ||
    movementTargets[actionTypeId] ||
    questTargets[actionTypeId] ||
    ['2', '7', '1'] // Default: Victim, Invoker, Self
  );
}

// ============================================================================
// PARAMETER SUGGESTIONS
// ============================================================================

/**
 * Suggest parameter values based on context
 */
export function suggestParameterValues(
  parameterName: string,
  nodeType: 'event' | 'action' | 'target',
  typeId: string
): Suggestion {
  const items: SuggestionItem[] = [];

  // Common duration suggestions
  if (parameterName.includes('Min') || parameterName.includes('Max') || parameterName.includes('Duration')) {
    items.push(
      { id: '1000', name: '1 second', description: '1000ms', relevance: 90 },
      { id: '2000', name: '2 seconds', description: '2000ms', relevance: 85 },
      { id: '3000', name: '3 seconds', description: '3000ms', relevance: 80 },
      { id: '5000', name: '5 seconds', description: '5000ms', relevance: 75 },
      { id: '10000', name: '10 seconds', description: '10000ms', relevance: 70 }
    );
  }

  // Phase suggestions
  if (parameterName === 'Phase' || parameterName.includes('Phase')) {
    items.push(
      { id: '0', name: 'All Phases', description: 'Active in all phases', relevance: 100 },
      { id: '1', name: 'Phase 1', description: 'Only phase 1', relevance: 90 },
      { id: '2', name: 'Phase 2', description: 'Only phase 2', relevance: 85 },
      { id: '4', name: 'Phase 3', description: 'Only phase 3', relevance: 80 },
      { id: '8', name: 'Phase 4', description: 'Only phase 4', relevance: 75 }
    );
  }

  // Chance suggestions
  if (parameterName === 'Chance') {
    items.push(
      { id: '100', name: '100% (Always)', description: 'Always triggers', relevance: 100 },
      { id: '50', name: '50% (Half)', description: '50% chance', relevance: 80 },
      { id: '25', name: '25% (Quarter)', description: '25% chance', relevance: 70 },
      { id: '10', name: '10% (Rare)', description: '10% chance', relevance: 60 },
      { id: '5', name: '5% (Very Rare)', description: '5% chance', relevance: 50 }
    );
  }

  return {
    type: 'parameter',
    items,
    context: {
      reason: `Common values for ${parameterName}`,
      confidence: items.length > 0 ? 0.7 : 0.3,
    },
  };
}

// ============================================================================
// TEMPLATE SUGGESTIONS
// ============================================================================

/**
 * Suggest templates based on context
 */
export function suggestTemplates(context?: {
  creatureType?: string;
  creatureRank?: string;
  existingEvents?: string[];
}): Suggestion {
  const items: SuggestionItem[] = [];

  // Boss templates
  if (context?.creatureRank === 'boss' || context?.creatureRank === 'elite') {
    items.push(
      {
        id: 'boss-phase-system',
        name: 'Boss Phase System',
        description: 'Multi-phase boss encounter with health-based phase transitions',
        relevance: 95,
        category: 'boss',
        tags: ['combat', 'phases', 'boss'],
      },
      {
        id: 'boss-add-summon',
        name: 'Boss Add Summons',
        description: 'Summon additional creatures at health thresholds',
        relevance: 90,
        category: 'boss',
        tags: ['combat', 'summon', 'boss'],
      }
    );
  }

  // Combat templates
  if (!context?.creatureRank || context.creatureRank === 'normal') {
    items.push(
      {
        id: 'basic-combat',
        name: 'Basic Combat',
        description: 'Simple combat script with spell casting',
        relevance: 100,
        category: 'combat',
        tags: ['combat', 'basic'],
      },
      {
        id: 'caster-combat',
        name: 'Caster Combat',
        description: 'Spellcaster with multiple spells',
        relevance: 85,
        category: 'combat',
        tags: ['combat', 'caster', 'spells'],
      },
      {
        id: 'on-aggro-yell',
        name: 'Aggro Yell',
        description: 'Yell text when entering combat',
        relevance: 80,
        category: 'dialogue',
        tags: ['dialogue', 'combat'],
      }
    );
  }

  // Quest templates
  items.push(
    {
      id: 'quest-giver',
      name: 'Quest Giver',
      description: 'Handle quest accept and reward with dialogue',
      relevance: 75,
      category: 'quest',
      tags: ['quest', 'dialogue'],
    },
    {
      id: 'quest-objective',
      name: 'Quest Objective',
      description: 'Complete quest objective on interaction',
      relevance: 70,
      category: 'quest',
      tags: ['quest', 'objective'],
    }
  );

  // Death templates
  items.push(
    {
      id: 'on-death-summon',
      name: 'Death Summon',
      description: 'Summon creatures on death',
      relevance: 65,
      category: 'summon',
      tags: ['death', 'summon'],
    },
    {
      id: 'on-death-yell',
      name: 'Death Yell',
      description: 'Yell text when dying',
      relevance: 60,
      category: 'dialogue',
      tags: ['death', 'dialogue'],
    }
  );

  return {
    type: 'template',
    items,
    context: {
      reason: 'Suggested templates based on creature type',
      confidence: 0.8,
    },
  };
}

// ============================================================================
// FIX SUGGESTIONS
// ============================================================================

/**
 * Suggest fixes for validation errors
 */
export function suggestFixes(errorMessage: string, node?: SAINode): Suggestion {
  const items: SuggestionItem[] = [];

  // Parse error message and suggest fixes
  if (errorMessage.includes('no connections')) {
    items.push({
      id: 'connect-node',
      name: 'Connect Node',
      description: 'Connect this node to other nodes in the script',
      relevance: 100,
    });
  }

  if (errorMessage.includes('no target')) {
    items.push({
      id: 'add-target',
      name: 'Add Target',
      description: 'Add a target node to specify who the action affects',
      relevance: 100,
    });
  }

  if (errorMessage.includes('missing')) {
    items.push({
      id: 'fill-required',
      name: 'Fill Required Fields',
      description: 'Complete all required parameter values',
      relevance: 100,
    });
  }

  if (errorMessage.includes('circular')) {
    items.push({
      id: 'break-cycle',
      name: 'Break Circular Link',
      description: 'Remove one event link to break the circular dependency',
      relevance: 100,
    });
  }

  return {
    type: 'fix',
    items,
    context: {
      reason: 'Suggested fixes for validation error',
      confidence: 0.9,
    },
  };
}

// ============================================================================
// CATEGORIZATION HELPERS
// ============================================================================

function getActionCategory(actionName: string): string {
  if (['CAST', 'ADD_AURA', 'REMOVE_AURA', 'INTERRUPT_SPELL'].includes(actionName)) {
    return 'Spells';
  }
  if (['TALK', 'SAY', 'YELL', 'WHISPER'].includes(actionName)) {
    return 'Communication';
  }
  if (['SUMMON_CREATURE', 'SUMMON_GO', 'DESPAWN'].includes(actionName)) {
    return 'Summoning';
  }
  if (['FOLLOW', 'MOVE_TO_POS', 'JUMP_TO_POS', 'FLEE'].includes(actionName)) {
    return 'Movement';
  }
  if (['SET_PHASE', 'SET_UNIT_FLAG', 'SET_FACTION', 'SET_SHEATH'].includes(actionName)) {
    return 'State Management';
  }
  if (['QUEST_OFFER', 'QUEST_FAIL', 'QUEST_CREDIT'].includes(actionName)) {
    return 'Quests';
  }
  if (['ATTACK_START', 'COMBAT_STOP', 'THREAT_ALL_PCT', 'SET_COMBAT_DIST'].includes(actionName)) {
    return 'Combat';
  }
  return 'Miscellaneous';
}

function getTargetCategory(targetName: string): string {
  if (['SELF', 'VICTIM', 'HOSTILE_RANDOM', 'HOSTILE_LAST_AGGRO'].includes(targetName)) {
    return 'Combat Targets';
  }
  if (['ACTION_INVOKER', 'ACTION_INVOKER_VEHICLE'].includes(targetName)) {
    return 'Invoker Targets';
  }
  if (['CLOSEST_CREATURE', 'CLOSEST_GAMEOBJECT', 'CLOSEST_PLAYER'].includes(targetName)) {
    return 'Proximity Targets';
  }
  if (['STORED', 'RANDOM_POINT', 'POSITION'].includes(targetName)) {
    return 'Position Targets';
  }
  return 'Miscellaneous';
}

function getActionTags(actionName: string): string[] {
  const tags: string[] = [];

  if (actionName.includes('CAST') || actionName.includes('SPELL') || actionName.includes('AURA')) {
    tags.push('magic');
  }
  if (actionName.includes('TALK') || actionName.includes('SAY') || actionName.includes('EMOTE')) {
    tags.push('social');
  }
  if (actionName.includes('SUMMON') || actionName.includes('SPAWN')) {
    tags.push('summon');
  }
  if (actionName.includes('MOVE') || actionName.includes('JUMP') || actionName.includes('FLEE')) {
    tags.push('movement');
  }
  if (actionName.includes('QUEST')) {
    tags.push('quest');
  }
  if (actionName.includes('ATTACK') || actionName.includes('COMBAT') || actionName.includes('THREAT')) {
    tags.push('combat');
  }

  return tags;
}

function getTargetTags(targetName: string): string[] {
  const tags: string[] = [];

  if (targetName.includes('PLAYER')) {
    tags.push('player');
  }
  if (targetName.includes('CREATURE')) {
    tags.push('creature');
  }
  if (targetName.includes('HOSTILE')) {
    tags.push('hostile');
  }
  if (targetName.includes('FRIENDLY')) {
    tags.push('friendly');
  }
  if (targetName.includes('RANDOM')) {
    tags.push('random');
  }

  return tags;
}

// ============================================================================
// EXAMPLE GENERATORS
// ============================================================================

function getActionExample(actionName: string, eventTypeId?: string): string {
  const examples: Record<string, string> = {
    CAST: 'Cast Fireball on current victim',
    TALK: 'Say "You dare challenge me?" to nearby players',
    SUMMON_CREATURE: 'Summon 2 guards at current position',
    EMOTE: 'Perform /roar emote',
    SET_PHASE: 'Change to phase 2 (enrage mode)',
    FOLLOW: 'Follow the quest giver',
    ATTACK_START: 'Begin attacking the player',
  };

  return examples[actionName] || `Use ${actionName}`;
}

function getTargetExample(targetName: string, actionTypeId?: string): string {
  const examples: Record<string, string> = {
    SELF: 'Target: This creature',
    VICTIM: 'Target: Current combat target',
    ACTION_INVOKER: 'Target: Player who triggered this',
    HOSTILE_RANDOM: 'Target: Random enemy in range',
    CLOSEST_CREATURE: 'Target: Nearest creature of specified type',
  };

  return examples[targetName] || `Target: ${targetName}`;
}

// ============================================================================
// SEARCH AND FILTER
// ============================================================================

/**
 * Search actions by name or description
 */
export function searchActions(query: string): SuggestionItem[] {
  const lowerQuery = query.toLowerCase();
  const items: SuggestionItem[] = [];

  SAI_ACTION_TYPES.forEach((actionType) => {
    const nameMatch = actionType.name.toLowerCase().includes(lowerQuery);
    const labelMatch = actionType.label.toLowerCase().includes(lowerQuery);

    if (nameMatch || labelMatch) {
      items.push({
        id: actionType.id,
        name: actionType.name,
        description: actionType.label,
        relevance: nameMatch ? 100 : 80,
        category: getActionCategory(actionType.name),
        tags: getActionTags(actionType.name),
      });
    }
  });

  // Sort by relevance
  items.sort((a, b) => b.relevance - a.relevance);

  return items;
}

/**
 * Search targets by name or description
 */
export function searchTargets(query: string): SuggestionItem[] {
  const lowerQuery = query.toLowerCase();
  const items: SuggestionItem[] = [];

  SAI_TARGET_TYPES.forEach((targetType) => {
    const nameMatch = targetType.name.toLowerCase().includes(lowerQuery);
    const labelMatch = targetType.label.toLowerCase().includes(lowerQuery);

    if (nameMatch || labelMatch) {
      items.push({
        id: targetType.id,
        name: targetType.name,
        description: targetType.label,
        relevance: nameMatch ? 100 : 80,
        category: getTargetCategory(targetType.name),
        tags: getTargetTags(targetType.name),
      });
    }
  });

  // Sort by relevance
  items.sort((a, b) => b.relevance - a.relevance);

  return items;
}
