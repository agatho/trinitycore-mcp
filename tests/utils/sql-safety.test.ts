/**
 * SQL Safety Utilities - Comprehensive Unit Tests
 *
 * Tests all SQL injection prevention utilities to ensure they correctly
 * block malicious inputs while allowing legitimate database operations.
 *
 * @module tests/utils/sql-safety
 */

import {
  validateTableName,
  validateColumnName,
  validateIdentifier,
  validateSortDirection,
  validateOperator,
  validateAggregateFunction,
  validateJoinType,
  buildSafeInClause,
  buildSafeOrderBy,
  buildSafeLimit,
  validateNumericValue,
  isTableAllowed,
  registerTable,
  getAllowedTables,
  SqlSafetyError,
} from '../../src/utils/sql-safety';

// =============================================================================
// validateTableName Tests
// =============================================================================

describe('validateTableName', () => {
  it('should accept valid TrinityCore world tables', () => {
    expect(validateTableName('creature_template', 'world')).toBe('`creature_template`');
    expect(validateTableName('item_template', 'world')).toBe('`item_template`');
    expect(validateTableName('quest_template', 'world')).toBe('`quest_template`');
    expect(validateTableName('spell_template', 'world')).toBe('`spell_template`');
    expect(validateTableName('npc_vendor', 'world')).toBe('`npc_vendor`');
    expect(validateTableName('creature_loot_template', 'world')).toBe('`creature_loot_template`');
  });

  it('should accept valid TrinityCore auth tables', () => {
    expect(validateTableName('account', 'auth')).toBe('`account`');
    expect(validateTableName('realmlist', 'auth')).toBe('`realmlist`');
    expect(validateTableName('build_info', 'auth')).toBe('`build_info`');
  });

  it('should accept valid TrinityCore characters tables', () => {
    expect(validateTableName('characters', 'characters')).toBe('`characters`');
    expect(validateTableName('character_inventory', 'characters')).toBe('`character_inventory`');
    expect(validateTableName('guild', 'characters')).toBe('`guild`');
  });

  it('should strip existing backticks before validation', () => {
    expect(validateTableName('`creature_template`', 'world')).toBe('`creature_template`');
  });

  it('should reject SQL injection attempts', () => {
    expect(() => validateTableName("'; DROP TABLE users--", 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table; DELETE FROM users', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('1 OR 1=1', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table UNION SELECT * FROM account', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table/**/UNION/**/SELECT', 'world')).toThrow(SqlSafetyError);
  });

  it('should reject empty or null table names', () => {
    expect(() => validateTableName('', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName(null as any, 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName(undefined as any, 'world')).toThrow(SqlSafetyError);
  });

  it('should reject tables not in the whitelist for specified database', () => {
    expect(() => validateTableName('nonexistent_table', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('creature_template', 'auth')).toThrow(SqlSafetyError);
  });

  it('should reject names with special characters', () => {
    expect(() => validateTableName('table.name', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table-name', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table name', 'world')).toThrow(SqlSafetyError);
    expect(() => validateTableName('table(name)', 'world')).toThrow(SqlSafetyError);
  });

  it('should reject names starting with numbers', () => {
    expect(() => validateTableName('123table', 'world')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateColumnName Tests
// =============================================================================

describe('validateColumnName', () => {
  it('should accept valid column names', () => {
    expect(validateColumnName('entry')).toBe('`entry`');
    expect(validateColumnName('name')).toBe('`name`');
    expect(validateColumnName('Classification')).toBe('`Classification`');
    expect(validateColumnName('npcflag')).toBe('`npcflag`');
    expect(validateColumnName('ContentTuningID')).toBe('`ContentTuningID`');
    expect(validateColumnName('stat_type1')).toBe('`stat_type1`');
  });

  it('should reject SQL injection in column names', () => {
    expect(() => validateColumnName("name; DROP TABLE--")).toThrow(SqlSafetyError);
    expect(() => validateColumnName("name' OR '1'='1")).toThrow(SqlSafetyError);
    expect(() => validateColumnName("1=1 UNION SELECT")).toThrow(SqlSafetyError);
  });

  it('should reject empty column names', () => {
    expect(() => validateColumnName('')).toThrow(SqlSafetyError);
    expect(() => validateColumnName(null as any)).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateIdentifier Tests
// =============================================================================

describe('validateIdentifier', () => {
  it('should accept valid SQL identifiers', () => {
    expect(validateIdentifier('myColumn')).toBe('myColumn');
    expect(validateIdentifier('table_name')).toBe('table_name');
    expect(validateIdentifier('_private')).toBe('_private');
    expect(validateIdentifier('Col123')).toBe('Col123');
  });

  it('should strip backticks', () => {
    expect(validateIdentifier('`myColumn`')).toBe('myColumn');
  });

  it('should reject unsafe identifiers', () => {
    expect(() => validateIdentifier("col; DROP TABLE")).toThrow(SqlSafetyError);
    expect(() => validateIdentifier("col' OR '1")).toThrow(SqlSafetyError);
    expect(() => validateIdentifier("col.name")).toThrow(SqlSafetyError);
    expect(() => validateIdentifier("")).toThrow(SqlSafetyError);
  });

  it('should use custom label in error messages', () => {
    try {
      validateIdentifier("bad;input", "sort field");
      fail('Expected SqlSafetyError');
    } catch (e: any) {
      expect(e.message).toContain('sort field');
    }
  });
});

// =============================================================================
// validateSortDirection Tests
// =============================================================================

describe('validateSortDirection', () => {
  it('should accept ASC and DESC (case insensitive)', () => {
    expect(validateSortDirection('ASC')).toBe('ASC');
    expect(validateSortDirection('DESC')).toBe('DESC');
    expect(validateSortDirection('asc')).toBe('ASC');
    expect(validateSortDirection('desc')).toBe('DESC');
    expect(validateSortDirection(' ASC ')).toBe('ASC');
  });

  it('should reject invalid directions', () => {
    expect(() => validateSortDirection('RANDOM')).toThrow(SqlSafetyError);
    expect(() => validateSortDirection("ASC; DROP TABLE")).toThrow(SqlSafetyError);
    expect(() => validateSortDirection('')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateOperator Tests
// =============================================================================

describe('validateOperator', () => {
  it('should accept standard SQL operators', () => {
    expect(validateOperator('=')).toBe('=');
    expect(validateOperator('!=')).toBe('!=');
    expect(validateOperator('<')).toBe('<');
    expect(validateOperator('>')).toBe('>');
    expect(validateOperator('<=')).toBe('<=');
    expect(validateOperator('>=')).toBe('>=');
    expect(validateOperator('LIKE')).toBe('LIKE');
    expect(validateOperator('IN')).toBe('IN');
    expect(validateOperator('NOT IN')).toBe('NOT IN');
    expect(validateOperator('IS NULL')).toBe('IS NULL');
    expect(validateOperator('BETWEEN')).toBe('BETWEEN');
  });

  it('should be case insensitive', () => {
    expect(validateOperator('like')).toBe('LIKE');
    expect(validateOperator('in')).toBe('IN');
  });

  it('should reject invalid operators', () => {
    expect(() => validateOperator('DROP')).toThrow(SqlSafetyError);
    expect(() => validateOperator("= OR 1=1")).toThrow(SqlSafetyError);
    expect(() => validateOperator('')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateAggregateFunction Tests
// =============================================================================

describe('validateAggregateFunction', () => {
  it('should accept standard aggregate functions', () => {
    expect(validateAggregateFunction('COUNT')).toBe('COUNT');
    expect(validateAggregateFunction('SUM')).toBe('SUM');
    expect(validateAggregateFunction('AVG')).toBe('AVG');
    expect(validateAggregateFunction('MIN')).toBe('MIN');
    expect(validateAggregateFunction('MAX')).toBe('MAX');
  });

  it('should reject non-aggregate functions', () => {
    expect(() => validateAggregateFunction('DROP')).toThrow(SqlSafetyError);
    expect(() => validateAggregateFunction('SLEEP')).toThrow(SqlSafetyError);
    expect(() => validateAggregateFunction('BENCHMARK')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateJoinType Tests
// =============================================================================

describe('validateJoinType', () => {
  it('should accept standard join types', () => {
    expect(validateJoinType('INNER')).toBe('INNER');
    expect(validateJoinType('LEFT')).toBe('LEFT');
    expect(validateJoinType('RIGHT')).toBe('RIGHT');
    expect(validateJoinType('CROSS')).toBe('CROSS');
  });

  it('should be case insensitive', () => {
    expect(validateJoinType('inner')).toBe('INNER');
    expect(validateJoinType('left')).toBe('LEFT');
  });

  it('should reject invalid join types', () => {
    expect(() => validateJoinType('NATURAL')).toThrow(SqlSafetyError);
    expect(() => validateJoinType("INNER; DROP")).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// buildSafeInClause Tests
// =============================================================================

describe('buildSafeInClause', () => {
  it('should build parameterized IN clause for numbers', () => {
    const result = buildSafeInClause([1, 2, 3]);
    expect(result.placeholders).toBe('?, ?, ?');
    expect(result.params).toEqual([1, 2, 3]);
  });

  it('should build parameterized IN clause for strings', () => {
    const result = buildSafeInClause(['a', 'b', 'c']);
    expect(result.placeholders).toBe('?, ?, ?');
    expect(result.params).toEqual(['a', 'b', 'c']);
  });

  it('should build parameterized IN clause for mixed types', () => {
    const result = buildSafeInClause([1, 'two', 3]);
    expect(result.placeholders).toBe('?, ?, ?');
    expect(result.params).toEqual([1, 'two', 3]);
  });

  it('should handle single value', () => {
    const result = buildSafeInClause([42]);
    expect(result.placeholders).toBe('?');
    expect(result.params).toEqual([42]);
  });

  it('should reject empty arrays', () => {
    expect(() => buildSafeInClause([])).toThrow(SqlSafetyError);
  });

  it('should reject non-array inputs', () => {
    expect(() => buildSafeInClause(null as any)).toThrow(SqlSafetyError);
    expect(() => buildSafeInClause(undefined as any)).toThrow(SqlSafetyError);
  });

  it('should reject arrays with invalid types', () => {
    expect(() => buildSafeInClause([{} as any])).toThrow(SqlSafetyError);
    expect(() => buildSafeInClause([null as any])).toThrow(SqlSafetyError);
  });

  it('should not be vulnerable to SQL injection via string values', () => {
    // These should produce safe parameterized output
    const result = buildSafeInClause(["'; DROP TABLE users--", "1 OR 1=1"]);
    expect(result.placeholders).toBe('?, ?');
    // Values go through params, never interpolated into SQL
    expect(result.params).toEqual(["'; DROP TABLE users--", "1 OR 1=1"]);
  });
});

// =============================================================================
// buildSafeOrderBy Tests
// =============================================================================

describe('buildSafeOrderBy', () => {
  it('should build safe ORDER BY clause', () => {
    expect(buildSafeOrderBy('entry', 'ASC')).toBe('ORDER BY `entry` ASC');
    expect(buildSafeOrderBy('name', 'DESC')).toBe('ORDER BY `name` DESC');
  });

  it('should default to ASC', () => {
    expect(buildSafeOrderBy('entry')).toBe('ORDER BY `entry` ASC');
  });

  it('should reject unsafe column names', () => {
    expect(() => buildSafeOrderBy("entry; DROP TABLE")).toThrow(SqlSafetyError);
  });

  it('should reject unsafe directions', () => {
    expect(() => buildSafeOrderBy('entry', 'RANDOM')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// buildSafeLimit Tests
// =============================================================================

describe('buildSafeLimit', () => {
  it('should build safe LIMIT clause', () => {
    expect(buildSafeLimit(50)).toBe('LIMIT 50');
    expect(buildSafeLimit(100)).toBe('LIMIT 100');
  });

  it('should cap at maxAllowed', () => {
    expect(buildSafeLimit(20000)).toBe('LIMIT 10000');
    expect(buildSafeLimit(500, 200)).toBe('LIMIT 200');
  });

  it('should handle zero', () => {
    expect(buildSafeLimit(0)).toBe('LIMIT 0');
  });

  it('should floor decimal values', () => {
    expect(buildSafeLimit(50.7)).toBe('LIMIT 50');
  });

  it('should reject negative values', () => {
    expect(() => buildSafeLimit(-1)).toThrow(SqlSafetyError);
  });

  it('should reject non-numeric values', () => {
    expect(() => buildSafeLimit("50" as any)).toThrow(SqlSafetyError);
    expect(() => buildSafeLimit(NaN)).toThrow(SqlSafetyError);
    expect(() => buildSafeLimit(Infinity)).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// validateNumericValue Tests
// =============================================================================

describe('validateNumericValue', () => {
  it('should accept valid integers', () => {
    expect(validateNumericValue(50)).toBe(50);
    expect(validateNumericValue(0)).toBe(0);
    expect(validateNumericValue(-10)).toBe(-10);
    expect(validateNumericValue(100000)).toBe(100000);
  });

  it('should accept numeric strings', () => {
    expect(validateNumericValue('50')).toBe(50);
    expect(validateNumericValue('0')).toBe(0);
  });

  it('should reject non-numeric values', () => {
    expect(() => validateNumericValue('abc')).toThrow(SqlSafetyError);
    expect(() => validateNumericValue(NaN)).toThrow(SqlSafetyError);
    expect(() => validateNumericValue(Infinity)).toThrow(SqlSafetyError);
    expect(() => validateNumericValue(null)).toThrow(SqlSafetyError);
    expect(() => validateNumericValue(undefined)).toThrow(SqlSafetyError);
  });

  it('should reject floating point values', () => {
    expect(() => validateNumericValue(50.5)).toThrow(SqlSafetyError);
  });

  it('should use custom label in error messages', () => {
    try {
      validateNumericValue('bad', 'limit');
      fail('Expected SqlSafetyError');
    } catch (e: any) {
      expect(e.message).toContain('limit');
    }
  });
});

// =============================================================================
// isTableAllowed Tests
// =============================================================================

describe('isTableAllowed', () => {
  it('should return true for whitelisted tables', () => {
    expect(isTableAllowed('creature_template', 'world')).toBe(true);
    expect(isTableAllowed('account', 'auth')).toBe(true);
    expect(isTableAllowed('characters', 'characters')).toBe(true);
  });

  it('should return false for non-whitelisted tables', () => {
    expect(isTableAllowed('nonexistent_table', 'world')).toBe(false);
    expect(isTableAllowed('creature_template', 'auth')).toBe(false);
  });

  it('should return false for unsafe table names', () => {
    expect(isTableAllowed("'; DROP TABLE--")).toBe(false);
    expect(isTableAllowed("table space")).toBe(false);
  });

  it('should check across all databases when none specified', () => {
    expect(isTableAllowed('creature_template')).toBe(true);
    expect(isTableAllowed('account')).toBe(true);
    expect(isTableAllowed('nonexistent')).toBe(false);
  });
});

// =============================================================================
// registerTable Tests
// =============================================================================

describe('registerTable', () => {
  it('should register new tables to the whitelist', () => {
    expect(isTableAllowed('custom_new_table', 'world')).toBe(false);
    registerTable('custom_new_table', 'world');
    expect(isTableAllowed('custom_new_table', 'world')).toBe(true);
  });

  it('should reject unsafe table names during registration', () => {
    expect(() => registerTable("'; DROP TABLE--", 'world')).toThrow(SqlSafetyError);
  });
});

// =============================================================================
// SqlSafetyError Tests
// =============================================================================

describe('SqlSafetyError', () => {
  it('should have correct name and code', () => {
    const error = new SqlSafetyError('test error');
    expect(error.name).toBe('SqlSafetyError');
    expect(error.code).toBe('SQL_SAFETY_VIOLATION');
    expect(error.message).toBe('test error');
  });

  it('should be an instance of Error', () => {
    const error = new SqlSafetyError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SqlSafetyError);
  });
});

// =============================================================================
// Integration-style Tests (real-world attack patterns)
// =============================================================================

describe('SQL Injection Attack Prevention', () => {
  describe('Classic SQL injection patterns', () => {
    const attackPatterns = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1; DELETE FROM creature_template",
      "1 UNION SELECT * FROM account",
      "1 UNION ALL SELECT username, password FROM account",
      "' OR 1=1--",
      "admin'--",
      "1; EXEC xp_cmdshell('net user')",
      "1'; WAITFOR DELAY '0:0:5'--",
      "1 AND (SELECT COUNT(*) FROM account) > 0",
    ];

    for (const attack of attackPatterns) {
      it(`should block table name attack: ${attack.substring(0, 40)}...`, () => {
        expect(() => validateTableName(attack, 'world')).toThrow(SqlSafetyError);
      });

      it(`should block column name attack: ${attack.substring(0, 40)}...`, () => {
        expect(() => validateColumnName(attack)).toThrow(SqlSafetyError);
      });

      it(`should block identifier attack: ${attack.substring(0, 40)}...`, () => {
        expect(() => validateIdentifier(attack)).toThrow(SqlSafetyError);
      });
    }
  });

  describe('IN clause injection prevention', () => {
    it('should safely handle SQL injection attempt in IN values', () => {
      // The values go through parameterized queries, so injection is neutralized
      const maliciousValues = ["1) UNION SELECT * FROM account--", "normal"];
      const result = buildSafeInClause(maliciousValues);
      // Output is just placeholders - values are in params, handled by MySQL driver
      expect(result.placeholders).toBe('?, ?');
      expect(result.params).toEqual(maliciousValues);
    });
  });

  describe('ORDER BY injection prevention', () => {
    it('should block ORDER BY injection', () => {
      expect(() => buildSafeOrderBy("entry; DROP TABLE")).toThrow(SqlSafetyError);
      expect(() => buildSafeOrderBy("entry", "ASC; DROP TABLE")).toThrow(SqlSafetyError);
    });
  });
});
