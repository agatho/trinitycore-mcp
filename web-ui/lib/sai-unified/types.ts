/**
 * TrinityCore SAI Unified Editor - Core Type Definitions
 *
 * Enterprise-grade TypeScript interfaces for Smart AI (SAI) script editing.
 * Supports all 282 SAI types (91 events + 160 actions + 31 targets).
 *
 * @module sai-unified/types
 * @version 3.0.0
 */

// ============================================================================
// PARAMETER TYPES
// ============================================================================

/**
 * SAI Parameter value types for type-safe editing
 */
export type SAIParameterType =
  | 'number'      // Generic numeric value
  | 'spell'       // Spell ID from Spell.dbc/db2
  | 'creature'    // Creature entry from creature_template
  | 'item'        // Item entry from item_template
  | 'quest'       // Quest ID from quest_template
  | 'gameobject'  // Gameobject entry from gameobject_template
  | 'text'        // Text ID from creature_text
  | 'flag'        // Bitwise flags
  | 'enum'        // Enumerated value with options
  | 'faction'     // Faction ID from FactionTemplate.dbc/db2
  | 'emote'       // Emote ID from Emotes.dbc/db2
  | 'sound'       // Sound ID from SoundEntries.dbc/db2
  | 'map'         // Map ID
  | 'zone'        // Zone ID
  | 'area';       // Area ID

/**
 * Parameter definition with validation rules
 */
export interface SAIParameter {
  /** Parameter name (e.g., "SpellID", "Distance") */
  name: string;

  /** Current value */
  value: number | string;

  /** Value type for validation and UI */
  type: SAIParameterType;

  /** Minimum allowed value (for number types) */
  min?: number;

  /** Maximum allowed value (for number types) */
  max?: number;

  /** Available options (for enum types) */
  options?: Array<{
    value: number | string;
    label: string;
    description?: string;
  }>;

  /** Human-readable description */
  description?: string;

  /** Custom validation function */
  validation?: (value: any) => string | null;

  /** Whether this parameter is required */
  required?: boolean;

  /** Default value when creating new nodes */
  defaultValue?: number | string;

  /** Units (for display purposes, e.g., "ms", "yards", "%") */
  units?: string;

  /** Tooltip help text */
  tooltip?: string;

  /** Whether this parameter uses string value (param_string columns) */
  isStringParam?: boolean;

  /** String value (for param_string columns) */
  stringValue?: string;
}

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Node type enumeration
 */
export type SAINodeType = 'event' | 'action' | 'target' | 'comment';

/**
 * SAI node (event, action, or target) in visual editor
 */
export interface SAINode {
  /** Unique node identifier */
  id: string;

  /** Node type */
  type: SAINodeType;

  /** SAI type ID (numeric string, e.g., "0", "11", "160") */
  typeId: string;

  /** SAI type name (e.g., "UPDATE_IC", "CAST", "VICTIM") */
  typeName: string;

  /** Human-readable label */
  label: string;

  /** Node parameters with values */
  parameters: SAIParameter[];

  /** Position in visual editor */
  position: {
    x: number;
    y: number;
  };

  /** Event phase mask (0 = all phases) */
  phase?: number;

  /** Execution chance (1-100, default: 100) */
  chance?: number;

  /** Event flags */
  flags?: number;

  /** Link to another event (for chaining) */
  link?: number;

  /** Dungeon/Raid difficulty restrictions (comma-separated difficulty IDs, empty = all) */
  difficulties?: string;

  /** Event cooldown minimum (milliseconds) */
  cooldownMin?: number;

  /** Event cooldown maximum (milliseconds) */
  cooldownMax?: number;

  /** String parameter (for modern TrinityCore param_string fields) */
  paramString?: string;

  /** Target position coordinates (for movement/summon/teleport actions) */
  targetPosition?: {
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
    /** Z coordinate (height) */
    z: number;
    /** Orientation in radians (0-2π) */
    o: number;
  };

  /** Node-specific metadata */
  metadata?: {
    /** Created by user ID */
    createdBy?: string;

    /** Creation timestamp */
    createdAt?: number;

    /** Last modified by user ID */
    modifiedBy?: string;

    /** Last modification timestamp */
    modifiedAt?: number;

    /** Whether node is locked for editing */
    locked?: boolean;

    /** Node-specific notes */
    notes?: string;

    /** Visual styling */
    style?: {
      color?: string;
      icon?: string;
      collapsed?: boolean;
    };
  };
}

// ============================================================================
// CONNECTION TYPES
// ============================================================================

/**
 * Connection type enumeration
 */
export type SAIConnectionType =
  | 'event-to-action'  // Event triggers action
  | 'action-to-target' // Action targets specific entity
  | 'link';            // Event links to another event

/**
 * Connection between nodes
 */
export interface SAIConnection {
  /** Unique connection identifier */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Connection type */
  type: SAIConnectionType;

  /** Connection metadata */
  metadata?: {
    /** Created by user ID */
    createdBy?: string;

    /** Creation timestamp */
    createdAt?: number;

    /** Visual styling */
    style?: {
      color?: string;
      animated?: boolean;
      label?: string;
    };
  };
}

// ============================================================================
// SCRIPT TYPES
// ============================================================================

/**
 * Source type enumeration
 */
export enum SAISourceType {
  Creature = 0,
  GameObject = 1,
  AreaTrigger = 2,
  Event = 3,
  Gossip = 4,
  Quest = 5,
  Spell = 6,
  Transport = 7,
  Instance = 8,
  TimedActionlist = 9,
}

/**
 * Complete SAI script with metadata
 */
export interface SAIScript {
  /** Unique script identifier */
  id: string;

  /** Script name (human-readable) */
  name: string;

  /** Entry or GUID */
  entryOrGuid: number;

  /** Source type (creature, gameobject, etc.) */
  sourceType: SAISourceType;

  /** All nodes in the script */
  nodes: SAINode[];

  /** Connections between nodes */
  connections: SAIConnection[];

  /** Script metadata */
  metadata: {
    /** Schema version for migrations */
    version: string;

    /** Creation timestamp */
    createdAt: number;

    /** Last modification timestamp */
    modifiedAt: number;

    /** Author/creator name or ID */
    author?: string;

    /** Script description */
    description?: string;

    /** Tags for categorization */
    tags?: string[];

    /** Whether script is locked for editing */
    locked?: boolean;

    /** Collaborators with access */
    collaborators?: string[];

    /** Change history summary */
    changeLog?: Array<{
      timestamp: number;
      user: string;
      action: string;
      description: string;
    }>;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue base interface
 */
export interface ValidationIssue {
  /** Node ID where issue was found */
  nodeId: string;

  /** Issue message */
  message: string;

  /** Specific parameter (if applicable) */
  parameter?: string;

  /** Severity level */
  severity: ValidationSeverity;

  /** Suggested fix (optional) */
  suggestion?: string;

  /** Auto-fix function (if available) */
  autoFix?: () => void;
}

/**
 * Validation error (blocks saving/export)
 */
export interface ValidationError extends ValidationIssue {
  severity: 'error';
}

/**
 * Validation warning (should be fixed, but not blocking)
 */
export interface ValidationWarning extends ValidationIssue {
  severity: 'warning';
}

/**
 * Validation info (helpful tip)
 */
export interface ValidationInfo extends ValidationIssue {
  severity: 'info';
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  /** Whether script is valid (no errors) */
  valid: boolean;

  /** Critical errors that block execution */
  errors: ValidationError[];

  /** Warnings that should be addressed */
  warnings: ValidationWarning[];

  /** Informational messages */
  info: ValidationInfo[];

  /** Overall validation score (0-100) */
  score?: number;

  /** Validation timestamp */
  timestamp?: number;
}

// ============================================================================
// SUGGESTION TYPES
// ============================================================================

/**
 * Suggestion type enumeration
 */
export type SuggestionType = 'action' | 'target' | 'parameter' | 'template' | 'fix';

/**
 * Individual suggestion item
 */
export interface SuggestionItem {
  /** Unique identifier */
  id: string;

  /** Suggestion name */
  name: string;

  /** Detailed description */
  description: string;

  /** Relevance score (0-100) */
  relevance: number;

  /** Category for grouping */
  category?: string;

  /** Tags for filtering */
  tags?: string[];

  /** Example usage */
  example?: string;

  /** Apply function (for quick-apply) */
  apply?: () => void;
}

/**
 * Suggestion result with context
 */
export interface Suggestion {
  /** Suggestion type */
  type: SuggestionType;

  /** Related node ID (if applicable) */
  nodeId?: string;

  /** Suggested items */
  items: SuggestionItem[];

  /** Suggestion context */
  context?: {
    /** Why these suggestions */
    reason?: string;

    /** Confidence level (0-1) */
    confidence?: number;
  };
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

/**
 * History action types
 */
export type HistoryAction =
  | 'add'          // Node/connection added
  | 'delete'       // Node/connection deleted
  | 'modify'       // Node/connection modified
  | 'move'         // Node position changed
  | 'connect'      // Connection created
  | 'disconnect'   // Connection removed
  | 'batch';       // Multiple operations

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  /** Unique entry identifier */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Action performed */
  action: HistoryAction;

  /** State before action */
  before: SAIScript;

  /** State after action */
  after: SAIScript;

  /** Human-readable description */
  description: string;

  /** User who performed action */
  user?: string;

  /** Whether this entry can be undone */
  canUndo: boolean;

  /** Whether this entry can be redone */
  canRedo: boolean;
}

// ============================================================================
// AI GENERATION TYPES
// ============================================================================

/**
 * AI generation request
 */
export interface AIGenerationRequest {
  /** Natural language prompt */
  prompt: string;

  /** Context for better generation */
  context?: {
    /** Creature entry ID */
    creatureEntry?: number;

    /** Creature type (beast, humanoid, etc.) */
    creatureType?: string;

    /** Creature rank (normal, elite, boss) */
    creatureRank?: string;

    /** Creature level */
    level?: number;

    /** Faction ID */
    faction?: number;

    /** Family (for beasts) */
    family?: string;

    /** Any additional context */
    additionalContext?: string;
  };

  /** Generation options */
  options?: {
    /** AI temperature (0-1, lower = more focused) */
    temperature?: number;

    /** Maximum tokens to generate */
    maxTokens?: number;

    /** AI model to use */
    model?: string;

    /** Number of variations to generate */
    variations?: number;
  };
}

/**
 * AI generation result
 */
export interface AIGenerationResult {
  /** Whether generation succeeded */
  success: boolean;

  /** Generated script (if successful) */
  script?: SAIScript;

  /** Alternative variations */
  alternatives?: SAIScript[];

  /** Error message (if failed) */
  error?: string;

  /** Confidence score (0-1) */
  confidence?: number;

  /** Suggestions for improvement */
  suggestions?: string[];

  /** Tokens used */
  tokensUsed?: number;

  /** Generation time (ms) */
  generationTime?: number;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Template category
 */
export type TemplateCategory =
  | 'combat'      // Combat AI
  | 'quest'       // Quest interactions
  | 'dialogue'    // NPC dialogue
  | 'movement'    // Movement patterns
  | 'summon'      // Summon mechanics
  | 'phase'       // Phase transitions
  | 'boss'        // Boss mechanics
  | 'vehicle'     // Vehicle interactions
  | 'custom';     // User-created

/**
 * SAI script template
 */
export interface SAITemplate {
  /** Unique template identifier */
  id: string;

  /** Template name */
  name: string;

  /** Description */
  description: string;

  /** Category */
  category: TemplateCategory;

  /** Tags for searching */
  tags?: string[];

  /** Difficulty level (1-5) */
  difficulty?: number;

  /** Template script */
  script: Partial<SAIScript>;

  /** Placeholders that need to be filled */
  placeholders?: Array<{
    path: string;
    label: string;
    description: string;
    defaultValue?: any;
  }>;

  /** Preview image or icon */
  preview?: string;

  /** Author */
  author?: string;

  /** Downloads/uses count */
  popularity?: number;
}

// ============================================================================
// EXPORT/IMPORT TYPES
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'sql' | 'json' | 'xml' | 'cpp' | 'yaml';

/**
 * Export options
 */
export interface ExportOptions {
  /** Format to export */
  format: ExportFormat;

  /** Include comments */
  includeComments?: boolean;

  /** Pretty print (formatted) */
  prettyPrint?: boolean;

  /** Include metadata */
  includeMetadata?: boolean;

  /** Compression */
  compress?: boolean;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Source format */
  format: ExportFormat;

  /** Validate before import */
  validate?: boolean;

  /** Merge with existing script */
  merge?: boolean;

  /** Conflict resolution strategy */
  conflictResolution?: 'overwrite' | 'skip' | 'prompt';
}

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

/**
 * User presence information
 */
export interface UserPresence {
  /** User ID */
  userId: string;

  /** Display name */
  displayName: string;

  /** Avatar URL */
  avatar?: string;

  /** Current cursor position */
  cursor?: {
    x: number;
    y: number;
  };

  /** Selected nodes */
  selectedNodes?: string[];

  /** Current action */
  currentAction?: string;

  /** Last activity timestamp */
  lastActivity: number;

  /** Connection status */
  status: 'active' | 'idle' | 'disconnected';
}

/**
 * Collaborative edit operation
 */
export interface CollaborativeOperation {
  /** Operation ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** User who performed operation */
  userId: string;

  /** Operation type */
  type: string;

  /** Operation data */
  data: any;

  /** Vector clock for ordering */
  vectorClock?: Record<string, number>;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Whether conflict was resolved */
  resolved: boolean;

  /** Resolution strategy used */
  strategy: 'manual' | 'auto' | 'merge';

  /** Resolved state */
  resolvedState?: SAIScript;

  /** Conflicts that need manual resolution */
  pendingConflicts?: Array<{
    path: string;
    localValue: any;
    remoteValue: any;
  }>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Read-only deep
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Callback function type
 */
export type Callback<T = void> = (data: T) => void;

/**
 * Async callback function type
 */
export type AsyncCallback<T = void> = (data: T) => Promise<void>;

/**
 * Event emitter interface
 */
export interface EventEmitter<T = any> {
  on(event: string, callback: Callback<T>): void;
  off(event: string, callback: Callback<T>): void;
  emit(event: string, data: T): void;
}

// ============================================================================
// AI PROVIDER TYPES
// ============================================================================

/**
 * AI model configuration
 */
export interface AIModel {
  /** Model identifier */
  id: string;

  /** Display name */
  name: string;

  /** Provider (openai, ollama, lmstudio, claude) */
  provider: 'openai' | 'ollama' | 'lmstudio' | 'claude';

  /** Context window size (tokens) */
  contextWindow: number;

  /** Whether model is available locally */
  isLocal?: boolean;

  /** Cost per 1K tokens (if applicable) */
  cost?: number;
}

/**
 * AI provider interface
 */
export interface AIProvider {
  /**
   * Generate SAI script from prompt
   */
  generateScript(request: AIGenerationRequest): Promise<AIGenerationResult>;

  /**
   * Test provider connection
   */
  testConnection?(): Promise<boolean>;

  /**
   * Get available models
   */
  getAvailableModels?(): Promise<AIModel[]>;
}
