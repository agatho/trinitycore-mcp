/**
 * SQL Safety Utilities
 *
 * Enterprise-grade SQL injection prevention utilities for TrinityCore MCP Server.
 * Provides whitelist-based validation for dynamic SQL components that cannot use
 * parameterized queries (table names, column names, ORDER BY, etc.).
 *
 * All dynamic SQL values MUST be validated through these utilities before inclusion
 * in SQL strings. Parameterized queries (?) should still be used for all data values.
 *
 * @module utils/sql-safety
 */

import { logger } from './logger.js';

// =============================================================================
// Constants - Whitelists
// =============================================================================

/**
 * Known TrinityCore database tables organized by database.
 * Any table name used in dynamic SQL MUST appear in this whitelist.
 */
const ALLOWED_TABLES: Record<string, ReadonlySet<string>> = {
  world: new Set([
    // Core game data tables
    'creature_template',
    'creature_template_difficulty',
    'creature_template_addon',
    'creature_template_movement',
    'creature_template_resistance',
    'creature_template_spell',
    'creature',
    'creature_addon',
    'creature_loot_template',
    'creature_questender',
    'creature_queststarter',
    'creature_text',
    'creature_formations',
    'creature_equip_template',
    'creature_model_info',
    'creature_onkill_reputation',
    'creature_summon_groups',

    // Item tables
    'item_template',
    'item_enchantment_template',
    'item_loot_template',

    // Quest tables
    'quest_template',
    'quest_template_addon',
    'quest_offer_reward',
    'quest_request_items',
    'quest_objectives',
    'quest_poi',
    'quest_poi_points',

    // Spell tables
    'spell_template',
    'spell_target_position',
    'spell_linked_spell',
    'spell_group',
    'spell_group_stack_rules',
    'spell_proc',
    'spell_scripts',
    'spell_area',
    'spell_bonus_data',
    'spell_loot_template',

    // NPC tables
    'npc_vendor',
    'npc_trainer',
    'npc_text',

    // Gameobject tables
    'gameobject_template',
    'gameobject_template_addon',
    'gameobject',
    'gameobject_loot_template',

    // World/Zone tables
    'areatrigger_teleport',
    'areatrigger_tavern',
    'game_graveyard',
    'instance_template',
    'battleground_template',

    // Conditions and scripts
    'conditions',
    'smart_scripts',
    'waypoints',
    'waypoint_data',
    'waypoint_scripts',

    // Loot tables
    'fishing_loot_template',
    'skinning_loot_template',
    'mining_loot_template',
    'disenchant_loot_template',
    'pickpocketing_loot_template',
    'prospecting_loot_template',
    'milling_loot_template',
    'reference_loot_template',

    // Gossip/Menu tables
    'gossip_menu',
    'gossip_menu_option',

    // Trainer tables
    'trainer',
    'trainer_spell',

    // Misc tables
    'pool_template',
    'pool_creature',
    'pool_gameobject',
    'game_event',
    'game_event_creature',
    'game_event_gameobject',
    'game_tele',
    'command',
    'access_requirement',
    'achievement_reward',
    'vehicle_template_accessory',
    'creature_classlevelstats',
    'player_classlevelstats',
    'player_levelstats',
    'exploration_basexp',
    'pet_levelstats',
    'reputation_reward_rate',
    'reputation_spillover_template',
    'skill_discovery_template',
    'skill_extra_item_template',
    'spell_required',
    'transports',
    'warden_action',
    'world_map_area',
    'world_template',
    'lfg_dungeon_template',
    'page_text',
    'points_of_interest',
    'script_waypoint',
    'game_weather',
    'trinity_string',
  ]),
  auth: new Set([
    'account',
    'account_access',
    'account_banned',
    'account_muted',
    'autobroadcast',
    'ip_banned',
    'logs',
    'realmlist',
    'realmcharacters',
    'uptime',
    'build_info',
    'battlenet_accounts',
    'battlenet_account_bans',
  ]),
  characters: new Set([
    'characters',
    'character_inventory',
    'character_spell',
    'character_talent',
    'character_queststatus',
    'character_reputation',
    'character_skills',
    'character_achievement',
    'character_achievement_progress',
    'character_aura',
    'character_action',
    'character_homebind',
    'character_social',
    'character_pet',
    'character_stats',
    'character_instance',
    'character_equipmentsets',
    'guild',
    'guild_member',
    'guild_rank',
    'guild_bank_tab',
    'guild_bank_item',
    'mail',
    'mail_items',
    'item_instance',
    'auctionhouse',
    'groups',
    'group_member',
    'arena_team',
    'arena_team_member',
    'corpse',
    'pet_aura',
    'pet_spell',
    'worldstates',
    'lag_reports',
    'character_garrison',
    'character_garrison_blueprints',
  ]),
};

/**
 * All allowed table names flattened into a single set for quick validation.
 */
const ALL_ALLOWED_TABLES: ReadonlySet<string> = new Set([
  ...ALLOWED_TABLES.world,
  ...ALLOWED_TABLES.auth,
  ...ALLOWED_TABLES.characters,
]);

/**
 * SQL identifier pattern - only alphanumeric characters and underscores are allowed.
 * This prevents SQL injection through identifiers.
 */
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Allowed aggregate functions for query builder.
 */
const ALLOWED_AGGREGATE_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
]);

/**
 * Allowed sort directions.
 */
const ALLOWED_SORT_DIRECTIONS = new Set(['ASC', 'DESC']);

/**
 * Allowed SQL operators for WHERE clauses.
 */
const ALLOWED_OPERATORS = new Set([
  '=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN',
  'IS NULL', 'IS NOT NULL', 'BETWEEN', 'NOT LIKE',
]);

/**
 * Allowed JOIN types.
 */
const ALLOWED_JOIN_TYPES = new Set(['INNER', 'LEFT', 'RIGHT', 'CROSS']);

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates that a table name is safe for use in SQL queries.
 * The table name must appear in the whitelist or match the safe identifier pattern.
 *
 * @param tableName - The table name to validate
 * @param database - Optional database scope to restrict validation
 * @returns The validated table name (backtick-quoted for safety)
 * @throws Error if the table name is not allowed
 *
 * @example
 * ```typescript
 * const safeName = validateTableName('creature_template', 'world');
 * // Returns: '`creature_template`'
 *
 * validateTableName("'; DROP TABLE--", 'world');
 * // Throws: "Invalid table name: '; DROP TABLE--"
 * ```
 */
export function validateTableName(tableName: string, database?: string): string {
  if (!tableName || typeof tableName !== 'string') {
    throw new SqlSafetyError(`Invalid table name: ${tableName}`);
  }

  // Strip any existing backticks for validation
  const cleanName = tableName.replace(/`/g, '');

  // Check against safe identifier pattern
  if (!SAFE_IDENTIFIER_PATTERN.test(cleanName)) {
    logger.warn('SQL Safety', `Rejected unsafe table name: ${tableName}`);
    throw new SqlSafetyError(`Invalid table name: ${tableName}`);
  }

  // Check against whitelist if database is specified
  if (database && ALLOWED_TABLES[database]) {
    if (!ALLOWED_TABLES[database].has(cleanName)) {
      logger.warn('SQL Safety', `Table '${cleanName}' not in whitelist for database '${database}'`);
      throw new SqlSafetyError(
        `Table '${cleanName}' is not in the allowed list for database '${database}'`
      );
    }
  } else if (!ALL_ALLOWED_TABLES.has(cleanName)) {
    // If no database specified, check all databases
    // Only warn - some tables might be dynamic (like INFORMATION_SCHEMA queries)
    if (!SAFE_IDENTIFIER_PATTERN.test(cleanName)) {
      throw new SqlSafetyError(`Invalid table name: ${tableName}`);
    }
    logger.debug('SQL Safety', `Table '${cleanName}' not in whitelist, but passes identifier check`);
  }

  return `\`${cleanName}\``;
}

/**
 * Validates a column name for use in SQL queries.
 * Column names must match the safe identifier pattern (alphanumeric + underscore).
 *
 * @param columnName - The column name to validate
 * @returns The validated column name (backtick-quoted)
 * @throws Error if the column name contains unsafe characters
 *
 * @example
 * ```typescript
 * const safeCol = validateColumnName('entry');
 * // Returns: '`entry`'
 *
 * validateColumnName("1; DROP TABLE users--");
 * // Throws: "Invalid column name: 1; DROP TABLE users--"
 * ```
 */
export function validateColumnName(columnName: string): string {
  if (!columnName || typeof columnName !== 'string') {
    throw new SqlSafetyError(`Invalid column name: ${columnName}`);
  }

  const cleanName = columnName.replace(/`/g, '');

  if (!SAFE_IDENTIFIER_PATTERN.test(cleanName)) {
    logger.warn('SQL Safety', `Rejected unsafe column name: ${columnName}`);
    throw new SqlSafetyError(`Invalid column name: ${columnName}`);
  }

  return `\`${cleanName}\``;
}

/**
 * Validates and sanitizes a SQL identifier (table name, column name, alias).
 * Unlike validateTableName, this does NOT check against a whitelist - only the pattern.
 *
 * @param identifier - The identifier to validate
 * @param label - Human-readable label for error messages
 * @returns The sanitized identifier
 * @throws Error if the identifier contains unsafe characters
 */
export function validateIdentifier(identifier: string, label: string = 'identifier'): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new SqlSafetyError(`Invalid ${label}: ${identifier}`);
  }

  const cleanName = identifier.replace(/`/g, '');

  if (!SAFE_IDENTIFIER_PATTERN.test(cleanName)) {
    logger.warn('SQL Safety', `Rejected unsafe ${label}: ${identifier}`);
    throw new SqlSafetyError(`Invalid ${label}: ${identifier}`);
  }

  return cleanName;
}

/**
 * Validates a sort direction (ASC or DESC).
 *
 * @param direction - The sort direction to validate
 * @returns The validated direction (uppercase)
 * @throws Error if direction is not ASC or DESC
 */
export function validateSortDirection(direction: string): 'ASC' | 'DESC' {
  const upper = (direction || '').toUpperCase().trim();
  if (!ALLOWED_SORT_DIRECTIONS.has(upper)) {
    throw new SqlSafetyError(`Invalid sort direction: ${direction}. Must be ASC or DESC.`);
  }
  return upper as 'ASC' | 'DESC';
}

/**
 * Validates a SQL operator.
 *
 * @param operator - The operator to validate
 * @returns The validated operator (uppercase)
 * @throws Error if operator is not in the allowed list
 */
export function validateOperator(operator: string): string {
  const upper = (operator || '').toUpperCase().trim();
  if (!ALLOWED_OPERATORS.has(upper)) {
    throw new SqlSafetyError(`Invalid SQL operator: ${operator}`);
  }
  return upper;
}

/**
 * Validates an aggregate function name.
 *
 * @param funcName - The aggregate function to validate
 * @returns The validated function name (uppercase)
 * @throws Error if function is not in the allowed list
 */
export function validateAggregateFunction(funcName: string): string {
  const upper = (funcName || '').toUpperCase().trim();
  if (!ALLOWED_AGGREGATE_FUNCTIONS.has(upper)) {
    throw new SqlSafetyError(`Invalid aggregate function: ${funcName}`);
  }
  return upper;
}

/**
 * Validates a JOIN type.
 *
 * @param joinType - The join type to validate
 * @returns The validated join type (uppercase)
 * @throws Error if join type is not in the allowed list
 */
export function validateJoinType(joinType: string): string {
  const upper = (joinType || '').toUpperCase().trim();
  if (!ALLOWED_JOIN_TYPES.has(upper)) {
    throw new SqlSafetyError(`Invalid JOIN type: ${joinType}`);
  }
  return upper;
}

// =============================================================================
// Safe SQL Building Helpers
// =============================================================================

/**
 * Builds a safe SQL IN clause with parameterized placeholders.
 * Replaces the unsafe pattern of `WHERE id IN (${values.join(',')})`.
 *
 * @param values - Array of values for the IN clause
 * @returns Object with the placeholder string and params array
 *
 * @example
 * ```typescript
 * const { placeholders, params } = buildSafeInClause([1, 2, 3]);
 * const sql = `SELECT * FROM table WHERE id IN (${placeholders})`;
 * // sql = "SELECT * FROM table WHERE id IN (?, ?, ?)"
 * // params = [1, 2, 3]
 * ```
 */
export function buildSafeInClause(values: (string | number)[]): {
  placeholders: string;
  params: (string | number)[];
} {
  if (!Array.isArray(values) || values.length === 0) {
    throw new SqlSafetyError('IN clause requires at least one value');
  }

  // Validate all values are safe types
  for (const val of values) {
    if (typeof val !== 'string' && typeof val !== 'number') {
      throw new SqlSafetyError(`Invalid value type in IN clause: ${typeof val}`);
    }
  }

  const placeholders = values.map(() => '?').join(', ');
  return { placeholders, params: [...values] };
}

/**
 * Builds a safe ORDER BY clause from column name and direction.
 *
 * @param column - Column name (validated against identifier pattern)
 * @param direction - Sort direction (ASC or DESC)
 * @returns Safe ORDER BY clause string
 *
 * @example
 * ```typescript
 * const orderBy = buildSafeOrderBy('entry', 'DESC');
 * // Returns: "ORDER BY `entry` DESC"
 * ```
 */
export function buildSafeOrderBy(column: string, direction: string = 'ASC'): string {
  const safeColumn = validateIdentifier(column, 'ORDER BY column');
  const safeDirection = validateSortDirection(direction);
  return `ORDER BY \`${safeColumn}\` ${safeDirection}`;
}

/**
 * Builds a safe LIMIT clause from a numeric value.
 *
 * @param limit - Maximum number of rows to return
 * @param maxAllowed - Maximum allowed limit value (default: 10000)
 * @returns Safe LIMIT clause string
 *
 * @example
 * ```typescript
 * const limitClause = buildSafeLimit(50);
 * // Returns: "LIMIT 50"
 *
 * buildSafeLimit(-1);
 * // Throws: "Invalid LIMIT value: -1"
 * ```
 */
export function buildSafeLimit(limit: number, maxAllowed: number = 10000): string {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0) {
    throw new SqlSafetyError(`Invalid LIMIT value: ${limit}`);
  }

  const safeLimitValue = Math.min(Math.floor(limit), maxAllowed);
  return `LIMIT ${safeLimitValue}`;
}

/**
 * Validates a numeric value for direct SQL interpolation.
 * Only use this when parameterized queries cannot be used (e.g., in LIMIT/OFFSET).
 *
 * @param value - The value to validate as a safe integer
 * @param label - Human-readable label for error messages
 * @returns The validated integer value
 * @throws Error if value is not a safe integer
 */
export function validateNumericValue(value: unknown, label: string = 'value'): number {
  if (value === null || value === undefined) {
    throw new SqlSafetyError(`Invalid numeric ${label}: ${value}`);
  }
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new SqlSafetyError(`Invalid numeric ${label}: ${value}`);
  }
  return num;
}

/**
 * Checks if a table name is in the whitelist (without throwing).
 *
 * @param tableName - Table name to check
 * @param database - Optional database scope
 * @returns True if table is allowed
 */
export function isTableAllowed(tableName: string, database?: string): boolean {
  const cleanName = (tableName || '').replace(/`/g, '');
  if (!SAFE_IDENTIFIER_PATTERN.test(cleanName)) {
    return false;
  }
  if (database && ALLOWED_TABLES[database]) {
    return ALLOWED_TABLES[database].has(cleanName);
  }
  return ALL_ALLOWED_TABLES.has(cleanName);
}

/**
 * Adds a table to the whitelist at runtime (for dynamically discovered tables).
 * This should only be called during initialization with validated data from
 * INFORMATION_SCHEMA queries.
 *
 * @param tableName - Table name to add
 * @param database - Database to add it to
 */
export function registerTable(tableName: string, database: string): void {
  if (!SAFE_IDENTIFIER_PATTERN.test(tableName)) {
    throw new SqlSafetyError(`Cannot register unsafe table name: ${tableName}`);
  }

  if (!ALLOWED_TABLES[database]) {
    ALLOWED_TABLES[database] = new Set();
  }

  (ALLOWED_TABLES[database] as Set<string>).add(tableName);
  (ALL_ALLOWED_TABLES as Set<string>).add(tableName);

  logger.debug('SQL Safety', `Registered table '${tableName}' for database '${database}'`);
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for SQL safety violations.
 * Provides clear identification of SQL injection prevention errors.
 */
export class SqlSafetyError extends Error {
  public readonly code = 'SQL_SAFETY_VIOLATION';

  constructor(message: string) {
    super(message);
    this.name = 'SqlSafetyError';

    // Log all safety violations for monitoring
    logger.warn('SQL Safety', `SQL Safety Violation: ${message}`);
  }
}

// =============================================================================
// Exports for Testing
// =============================================================================

/**
 * Get a copy of the current whitelist (for testing/debugging only).
 */
export function getAllowedTables(database?: string): ReadonlySet<string> {
  if (database && ALLOWED_TABLES[database]) {
    return ALLOWED_TABLES[database];
  }
  return ALL_ALLOWED_TABLES;
}
