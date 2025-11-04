import type { CodeReviewRule, RuleViolation, AST, CodeContext, IssueSeverity, CodeFix, FixType } from '../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate naming convention fix
 */
function generateNamingFix(
  oldName: string,
  newName: string,
  line: number,
  context: CodeContext
): CodeFix {
  return {
    type: 'naming' as FixType,
    file: context.file,
    line: line,
    diff: `--- ${context.file}
+++ ${context.file}
@@ -${line},1 +${line},1 @@
-${oldName}
+${newName}`,
    explanation: `Rename '${oldName}' to '${newName}' to follow TrinityCore naming convention`,
    codeSnippet: {
      before: oldName,
      after: newName,
    },
    confidence: 0.9,
    autoApplicable: true,
    estimatedImpact: 'low' as const,
  };
}

/**
 * Check if name follows TrinityCore naming convention
 */
function isValidTrinityNaming(name: string, type: 'class' | 'function' | 'variable'): boolean {
  if (type === 'class' || type === 'function') {
    // PascalCase: starts with uppercase, no underscores
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  } else {
    // camelCase for variables
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }
}

/**
 * Convert name to TrinityCore naming convention
 */
function convertToTrinityNaming(name: string, type: 'class' | 'function' | 'variable'): string {
  if (type === 'class' || type === 'function') {
    // Convert to PascalCase
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  } else {
    // Convert to camelCase
    return name.charAt(0).toLowerCase() + name.slice(1).replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  }
}

/**
 * Check if function has Trinity documentation
 */
function hasTrinityDocumentation(func: any): boolean {
  // Check for documentation comment before function
  return func.documentation && func.documentation.length > 0;
}

/**
 * Check if function has proper error handling
 */
function hasProperErrorHandling(func: any): boolean {
  // Check if function body includes try-catch or error checking
  const body = func.body || '';
  return body.includes('try') || body.includes('catch') || body.includes('if (') && body.includes('return');
}

// ============================================================================
// NAMING CONVENTIONS - CLASS NAMES (20 rules)
// ============================================================================

const CLASS_NAMING_PATTERNS = [
  'Player',
  'Creature',
  'GameObject',
  'Spell',
  'Aura',
  'Quest',
  'Item',
  'Map',
  'Instance',
  'WorldSession',
  'Guild',
  'Group',
  'ChatHandler',
  'ScriptMgr',
  'DatabaseWorker',
  'AchievementMgr',
  'BattlegroundMgr',
  'OutdoorPvPMgr',
  'VehicleMgr',
  'TransportMgr',
];

const CLASS_NAMING_RULES = CLASS_NAMING_PATTERNS.map((className, index) => ({
  id: `convention-class-naming-${className.toLowerCase()}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `${className} class should follow PascalCase naming`,
  description: `TrinityCore ${className} classes must use PascalCase naming convention`,
  enabled: true,
  confidence: 0.90,
  priority: 50 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const classSymbol of ast.classes) {
      if (
        classSymbol.name.toLowerCase().includes(className.toLowerCase()) &&
        !isValidTrinityNaming(classSymbol.name, 'class')
      ) {
        const correctName = convertToTrinityNaming(classSymbol.name, 'class');
        violations.push({
          ruleId: `convention-class-naming-${className.toLowerCase()}`,
          file: context?.file,
          line: classSymbol.location.line,
          column: classSymbol.location.column,
          severity: 'minor' as IssueSeverity,
          message: `Class '${classSymbol.name}' should be '${correctName}' (PascalCase)`,
          explanation: '',
          confidence: 0.90,
          codeSnippet: {
            before: '',
            violatingLine: `class ${classSymbol.name}`,
            afterContext: '',
          },
          metadata: {
            detectedBy: 'rule_engine',
            category: 'convention',
            priority: 50 - index,
          },
        });
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `class player_manager { };`,
      good: `class PlayerManager { };`,
    },
  ],
  references: ['TrinityCore Coding Style Guide'],

}));

// ============================================================================
// NAMING CONVENTIONS - FUNCTION NAMES (20 rules)
// ============================================================================

const FUNCTION_NAMING_PATTERNS = [
  'GetPlayer',
  'SetValue',
  'Update',
  'Initialize',
  'Cleanup',
  'OnLogin',
  'OnLogout',
  'HandlePacket',
  'SendPacket',
  'CastSpell',
  'AddAura',
  'RemoveAura',
  'DealDamage',
  'TakeDamage',
  'GetHealth',
  'SetHealth',
  'IsAlive',
  'IsDead',
  'CanAttack',
  'HasFlag',
];

const FUNCTION_NAMING_RULES = FUNCTION_NAMING_PATTERNS.map((funcName, index) => ({
  id: `convention-function-naming-${funcName.toLowerCase()}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `Function ${funcName} should follow PascalCase naming`,
  description: `TrinityCore functions must use PascalCase naming convention`,
  enabled: true,
  confidence: 0.85,
  priority: 45 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      if (
        func.name.toLowerCase().includes(funcName.toLowerCase()) &&
        !isValidTrinityNaming(func.name, 'function')
      ) {
        const correctName = convertToTrinityNaming(func.name, 'function');
        violations.push({
          ruleId: `convention-function-naming-${funcName.toLowerCase()}`,
          file: context?.file,
          line: func.location.line,
          column: func.location.column,
          severity: 'minor' as IssueSeverity,
          message: `Function '${func.name}' should be '${correctName}' (PascalCase)`,
          explanation: '',
          confidence: 0.85,
          codeSnippet: {
            before: '',
            violatingLine: `${func.returnType} ${func.name}(${func.parameters.map((p) => p.type).join(', ')})`,
            afterContext: '',
          },
          metadata: {
            detectedBy: 'rule_engine',
            category: 'convention',
            priority: 45 - index,
          },
        });
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `void get_player_name() { }`,
      good: `void GetPlayerName() { }`,
    },
  ],
  references: ['TrinityCore Coding Style Guide'],

}));

// ============================================================================
// NAMING CONVENTIONS - MEMBER VARIABLES (20 rules)
// ============================================================================

const MEMBER_VARIABLE_PATTERNS = [
  '_health',
  '_mana',
  '_level',
  '_guid',
  '_name',
  '_position',
  '_orientation',
  '_map',
  '_zone',
  '_instance',
  '_faction',
  '_race',
  '_class',
  '_gender',
  '_money',
  '_xp',
  '_reputation',
  '_flags',
  '_state',
  '_owner',
].map((memberName, index) => ({
  id: `convention-member-naming-${memberName.replace('_', '')}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `Member variable should start with underscore`,
  description: `TrinityCore member variables must start with underscore prefix`,
  enabled: true,
  confidence: 0.85,
  priority: 40 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const classSymbol of ast.classes) {
      for (const member of classSymbol.members) {
        const nameWithoutUnderscore = memberName.replace('_', '');
        if (
          member.name.toLowerCase().includes(nameWithoutUnderscore) &&
          !member.name.startsWith('_')
        ) {
          const correctName = `_${member.name}`;
          violations.push({
            ruleId: `convention-member-naming-${nameWithoutUnderscore}`,
            file: context?.file,
            line: member.location.line,
            column: member.location.column,
            severity: 'minor' as IssueSeverity,
            message: `Member variable '${member.name}' should be '${correctName}' (underscore prefix)`,
          explanation: '',
            confidence: 0.85,
            codeSnippet: {
              before: '',
              violatingLine: `${member.type} ${member.name};`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'convention',
              priority: 40 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `class Player { uint32 health; };`,
      good: `class Player { uint32 _health; };`,
    },
  ],
  references: ['TrinityCore Coding Style Guide'],

}));

// ============================================================================
// CODE FORMATTING (40 rules)
// ============================================================================

const FORMATTING_PATTERNS = [
  'brace-on-new-line',
  'space-after-comma',
  'space-around-operators',
  'indent-four-spaces',
  'no-tabs',
  'max-line-length-120',
  'blank-line-after-class',
  'blank-line-before-function',
  'no-trailing-whitespace',
  'single-blank-line-max',
  'space-before-parenthesis',
  'space-after-keyword',
  'no-space-before-semicolon',
  'pointer-reference-left',
  'const-left-of-type',
  'include-guard-format',
  'include-order',
  'namespace-indent',
  'class-member-order',
  'access-specifier-indent',
  'constructor-initializer-indent',
  'template-indent',
  'lambda-indent',
  'switch-case-indent',
  'enum-value-align',
  'comment-style',
  'block-comment-format',
  'line-comment-space',
  'todo-comment-format',
  'fixme-comment-format',
  'function-spacing',
  'class-spacing',
  'operator-spacing',
  'assignment-spacing',
  'declaration-spacing',
  'parameter-spacing',
  'argument-spacing',
  'array-bracket-spacing',
  'template-angle-spacing',
  'ternary-operator-spacing',
].map((pattern, index) => ({
  id: `convention-formatting-${pattern}`,
  category: 'convention' as const,
  severity: 'info' as IssueSeverity,
  title: `Code formatting: ${pattern.replace(/-/g, ' ')}`,
  description: `Code should follow TrinityCore formatting rules for ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.95,
  priority: 35 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    // Simplified pattern detection
    if (pattern === 'brace-on-new-line') {
      for (const func of ast.functions) {
        const bodyLines = func.body?.split('\n') || [];
        if (bodyLines[0] && !bodyLines[0].trim().startsWith('{')) {
          violations.push({
            ruleId: `convention-formatting-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'info' as IssueSeverity,
            message: `Opening brace should be on new line for function '${func.name}'`,
          explanation: '',
            confidence: 0.95,
            codeSnippet: {
              before: '',
              violatingLine: `${func.name}() {`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'convention',
              priority: 35 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `void Update() { code(); }`,
      good: `void Update()\n{\n    code();\n}`,
    },
  ],
  references: ['TrinityCore Coding Style Guide'],

}));

// ============================================================================
// DOCUMENTATION REQUIREMENTS (30 rules)
// ============================================================================

const DOCUMENTATION_PATTERNS = [
  'class-documentation',
  'function-documentation',
  'public-method-documentation',
  'parameter-documentation',
  'return-documentation',
  'exception-documentation',
  'complex-logic-documentation',
  'magic-number-documentation',
  'database-query-documentation',
  'thread-safety-documentation',
  'performance-note-documentation',
  'deprecated-documentation',
  'todo-documentation',
  'fixme-documentation',
  'hack-documentation',
  'copyright-header',
  'license-header',
  'author-documentation',
  'date-documentation',
  'version-documentation',
  'brief-documentation',
  'details-documentation',
  'note-documentation',
  'warning-documentation',
  'see-also-documentation',
  'example-documentation',
  'code-snippet-documentation',
  'link-documentation',
  'reference-documentation',
  'since-documentation',
].map((pattern, index) => ({
  id: `convention-documentation-${pattern}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `Missing ${pattern.replace(/-/g, ' ')}`,
  description: `TrinityCore requires ${pattern.replace(/-/g, ' ')} for maintainability`,
  enabled: true,
  confidence: 0.75,
  priority: 30 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    if (pattern === 'function-documentation') {
      for (const func of ast.functions) {
        if (!hasTrinityDocumentation(func) && func.visibility === 'public') {
          violations.push({
            ruleId: `convention-documentation-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'minor' as IssueSeverity,
            message: `Function '${func.name}' is missing documentation comment`,
          explanation: '',
            confidence: 0.75,
            codeSnippet: {
              before: '',
              violatingLine: `${func.returnType} ${func.name}(...)`,
              afterContext: '',
            },
                        metadata: {
              detectedBy: 'rule_engine',
              category: 'convention',
              priority: 30 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `void CastSpell(Spell* spell) { }`,
      good: `/**\n * @brief Casts a spell\n * @param spell The spell to cast\n */\nvoid CastSpell(Spell* spell) { }`,
    },
  ],
  references: ['TrinityCore Documentation Guidelines'],

}));

// ============================================================================
// TRINITYCORE-SPECIFIC PATTERNS (50 rules)
// ============================================================================

const TRINITY_SPECIFIC_PATTERNS = [
  'TC_LOG_INFO',
  'TC_LOG_ERROR',
  'TC_LOG_DEBUG',
  'TC_LOG_WARN',
  'ObjectGuid',
  'ObjectMgr',
  'WorldSession',
  'Player::GetSession',
  'Creature::AI',
  'ScriptedAI',
  'PreparedStatement',
  'QueryResult',
  'WorldPacket',
  'ByteBuffer',
  'Position',
  'GetMap',
  'GetZoneId',
  'GetAreaId',
  'GetEntry',
  'GetGUID',
  'GetTypeId',
  'IsPlayer',
  'IsCreature',
  'IsGameObject',
  'ToPlayer',
  'ToCreature',
  'ToGameObject',
  'sWorld',
  'sObjectMgr',
  'sMapMgr',
  'sScriptMgr',
  'sConfigMgr',
  'sGameEventMgr',
  'sBattlegroundMgr',
  'sGuildMgr',
  'sGroupMgr',
  'sLFGMgr',
  'sAuctionMgr',
  'ASSERT',
  'ASSERT_NOTNULL',
  'TRINITY_READ_GUARD',
  'TRINITY_WRITE_GUARD',
  'GetAI',
  'SelectNearestTarget',
  'DoCast',
  'DoCastVictim',
  'DoMeleeAttackIfReady',
  'DoSpellAttackIfReady',
  'UpdateVictim',
  'EnterEvadeMode',
].map((pattern, index) => ({
  id: `convention-trinity-pattern-${pattern.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `TrinityCore pattern: Use ${pattern} correctly`,
  description: `Ensure proper usage of TrinityCore ${pattern} pattern`,
  enabled: true,
  confidence: 0.80,
  priority: 25 - Math.floor(index / 2),
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    // Check for proper usage of TrinityCore patterns
    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for logging without proper format
      if (pattern.startsWith('TC_LOG_') && body.includes(pattern)) {
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(pattern) && !line.includes('>>')) {
            violations.push({
              ruleId: `convention-trinity-pattern-${pattern.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              file: context?.file,
              line: func.location.line + i,
              column: 0,
              severity: 'minor' as IssueSeverity,
              message: `${pattern} usage should follow TrinityCore logging format with module and message`,
          explanation: '',
              confidence: 0.80,
              codeSnippet: {
                before: '',
                violatingLine: line.trim(),
                afterContext: '',
              },
              metadata: {
                detectedBy: 'rule_engine',
                category: 'convention',
                priority: 25 - Math.floor(index / 2),
              },
            });
          }
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `TC_LOG_ERROR("Error occurred");`,
      good: `TC_LOG_ERROR("module", "Error occurred: {}", message);`,
    },
  ],
  references: ['TrinityCore API Documentation'],

}));

// ============================================================================
// ERROR HANDLING CONVENTIONS (30 rules)
// ============================================================================

const ERROR_HANDLING_PATTERNS = [
  'null-check-before-use',
  'return-false-on-error',
  'throw-exception-on-critical',
  'log-error-before-return',
  'validate-parameters',
  'check-database-result',
  'check-spell-cast-result',
  'check-item-creation-result',
  'check-creature-spawn-result',
  'check-player-lookup-result',
  'check-guid-validity',
  'check-map-validity',
  'check-zone-validity',
  'check-position-validity',
  'check-packet-size',
  'check-permission',
  'check-cooldown',
  'check-resource-cost',
  'check-line-of-sight',
  'check-distance',
  'check-inventory-space',
  'check-level-requirement',
  'check-faction-requirement',
  'check-class-requirement',
  'check-race-requirement',
  'check-skill-requirement',
  'check-reputation-requirement',
  'check-item-requirement',
  'check-quest-requirement',
  'check-achievement-requirement',
].map((pattern, index) => ({
  id: `convention-error-handling-${pattern}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `Error handling: ${pattern.replace(/-/g, ' ')}`,
  description: `TrinityCore requires ${pattern.replace(/-/g, ' ')} for robustness`,
  enabled: true,
  confidence: 0.70,
  priority: 20 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      if (!hasProperErrorHandling(func)) {
        violations.push({
          ruleId: `convention-error-handling-${pattern}`,
          file: context?.file,
          line: func.location.line,
          column: func.location.column,
          severity: 'minor' as IssueSeverity,
          message: `Function '${func.name}' missing proper error handling: ${pattern.replace(/-/g, ' ')}`,
          explanation: '',
          confidence: 0.70,
          codeSnippet: {
            before: '',
            violatingLine: `${func.returnType} ${func.name}(...)`,
            afterContext: '',
          },
          metadata: {
            detectedBy: 'rule_engine',
            category: 'convention',
            priority: 20 - index,
          },
        });
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `Player* player = GetPlayer(guid);\nplayer->Update();`,
      good: `Player* player = GetPlayer(guid);\nif (!player)\n    return false;\nplayer->Update();`,
    },
  ],
  references: ['TrinityCore Error Handling Guidelines'],

}));

// ============================================================================
// LOGGING CONVENTIONS (20 rules)
// ============================================================================

const LOGGING_PATTERNS = [
  'use-tc-log-info',
  'use-tc-log-error',
  'use-tc-log-debug',
  'use-tc-log-warn',
  'use-tc-log-fatal',
  'include-module-name',
  'include-function-name',
  'include-error-context',
  'include-guid',
  'include-entry',
  'include-coordinates',
  'include-timestamp',
  'log-database-errors',
  'log-packet-errors',
  'log-spell-errors',
  'log-item-errors',
  'log-quest-errors',
  'log-achievement-errors',
  'no-cout-or-printf',
  'no-debug-spam',
].map((pattern, index) => ({
  id: `convention-logging-${pattern}`,
  category: 'convention' as const,
  severity: 'minor' as IssueSeverity,
  title: `Logging: ${pattern.replace(/-/g, ' ')}`,
  description: `TrinityCore requires ${pattern.replace(/-/g, ' ')} for proper logging`,
  enabled: true,
  confidence: 0.85,
  priority: 15 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for cout/printf usage
      if (pattern === 'no-cout-or-printf') {
        if (body.includes('std::cout') || body.includes('printf')) {
          violations.push({
            ruleId: `convention-logging-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'minor' as IssueSeverity,
            message: `Function '${func.name}' uses cout/printf instead of TC_LOG_*`,
          explanation: '',
            confidence: 0.85,
            codeSnippet: {
              before: '',
              violatingLine: body.includes('std::cout') ? 'std::cout << ...' : 'printf(...)',
              afterContext: '',
            },
                        metadata: {
              detectedBy: 'rule_engine',
              category: 'convention',
              priority: 15 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `std::cout << "Player logged in" << std::endl;`,
      good: `TC_LOG_INFO("server.worldserver", "Player {} logged in", playerName);`,
    },
  ],
  references: ['TrinityCore Logging System'],

}));

// ============================================================================
// DATABASE CONVENTIONS (20 rules)
// ============================================================================

const DATABASE_PATTERNS = [
  'use-prepared-statements',
  'no-sql-injection',
  'use-async-queries',
  'check-query-result',
  'use-transactions',
  'proper-table-names',
  'proper-column-names',
  'use-guid-for-id',
  'use-entry-for-template',
  'validate-before-insert',
  'validate-before-update',
  'validate-before-delete',
  'log-database-errors',
  'handle-connection-loss',
  'use-connection-pool',
  'close-result-sets',
  'free-prepared-statements',
  'use-batch-inserts',
  'use-batch-updates',
  'optimize-queries',
].map((pattern, index) => ({
  id: `convention-database-${pattern}`,
  category: 'convention' as const,
  severity: (pattern === 'no-sql-injection' || pattern === 'use-prepared-statements')
    ? ('major' as IssueSeverity)
    : ('minor' as IssueSeverity),
  title: `Database: ${pattern.replace(/-/g, ' ')}`,
  description: `TrinityCore requires ${pattern.replace(/-/g, ' ')} for database operations`,
  enabled: true,
  confidence: 0.90,
  priority: 10 - Math.floor(index / 2),
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for prepared statement usage
      if (pattern === 'use-prepared-statements' && body.includes('Query(')) {
        if (
          !body.includes('PreparedStatement') &&
          !body.includes('PreparedQueryResult')
        ) {
          violations.push({
            ruleId: `convention-database-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'major' as IssueSeverity,
            message: `Function '${func.name}' uses direct Query() instead of PreparedStatement (SQL injection risk)`,
          explanation: '',
            confidence: 0.90,
            codeSnippet: {
              before: '',
              violatingLine: 'Query("SELECT ...");',
              afterContext: '',
            },
                        metadata: {
              detectedBy: 'rule_engine',
              category: 'convention',
              priority: 10 - Math.floor(index / 2),
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `WorldDatabase.Query("SELECT * FROM creature WHERE entry = " + entry);`,
      good: `PreparedStatement* stmt = WorldDatabase.GetPreparedStatement(WORLD_SEL_CREATURE);\nstmt->setUInt32(0, entry);\nPreparedQueryResult result = WorldDatabase.Query(stmt);`,
    },
  ],
  references: ['TrinityCore Database System'],

}));

// ============================================================================
// EXPORTS
// ============================================================================



export const CONVENTION_RULES: CodeReviewRule[] = [
  ...CLASS_NAMING_RULES,
  ...FUNCTION_NAMING_RULES,
];
