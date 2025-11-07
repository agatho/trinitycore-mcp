/**
 * Null Safety Rules - Critical Pointer Null Check Detection
 * Priority #4: AI-Powered Code Review
 *
 * This module implements 200 null safety rules for TrinityCore pointer types.
 * These rules detect missing null checks that could cause server crashes.
 *
 * Target: 200 rules
 * - Player pointer checks: 40 rules
 * - Unit pointer checks: 50 rules
 * - Creature pointer checks: 40 rules
 * - GameObject pointer checks: 35 rules
 * - WorldSession pointer checks: 30 rules
 * - Miscellaneous pointer checks: 5 rules
 *
 * Performance target: <100ms for typical file analysis
 */

import {
  CodeReviewRule,
  RuleViolation,
  AST,
  CodeContext,
  VariableSymbol,
  CodeFix,
  IssueSeverity,
} from '../types';
import { logger } from '../../utils/logger';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find all variables of a specific type
 */
function findVariablesOfType(ast: AST, typeName: string): VariableSymbol[] {
  const variables: VariableSymbol[] = [];
  for (const [name, variable] of ast.symbols.variables) {
    if (variable.type.includes(typeName) && variable.isPointer) {
      variables.push(variable);
    }
  }
  return variables;
}

/**
 * Find method calls on a variable
 */
function findMethodCallsOnVariable(
  ast: AST,
  variable: VariableSymbol,
  methodNames?: string[]
): Array<{ line: number; column: number; method: string }> {
  const calls: Array<{ line: number; column: number; method: string }> = [];
  const lines = ast.root.raw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for pattern: variableName->methodName(
    const callPattern = new RegExp(
      `${variable.name}\\s*->\\s*(\\w+)\\s*\\(`,
      'g'
    );

    let match;
    while ((match = callPattern.exec(line)) !== null) {
      const method = match[1];
      if (!methodNames || methodNames.includes(method)) {
        calls.push({
          line: i + 1,
          column: match.index,
          method,
        });
      }
    }
  }

  return calls;
}

/**
 * Check if there's a null check in path to usage
 */
function hasNullCheckInPath(
  ast: AST,
  variable: VariableSymbol,
  usageLine: number
): boolean {
  const lines = ast.root.raw.split('\n');

  // Search backwards from usage line to variable declaration
  for (let i = variable.line; i < usageLine; i++) {
    const line = lines[i];

    // Check for various null check patterns
    if (
      line.includes(`if (!${variable.name})`) ||
      line.includes(`if (${variable.name} == nullptr)`) ||
      line.includes(`if (nullptr == ${variable.name})`) ||
      line.includes(`if (${variable.name} == NULL)`) ||
      line.includes(`if (!${variable.name}.get())`) ||
      line.includes(`ASSERT(${variable.name})`) ||
      line.includes(`ASSERT_NOTNULL(${variable.name})`) ||
      line.match(new RegExp(`if\\s*\\(\\s*${variable.name}\\s*\\)`))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Generate null check fix for a pointer dereference
 */
function generateNullCheckFix(
  file: string,
  variable: VariableSymbol,
  usageLine: number,
  usageColumn: number,
  usageCode: string
): CodeFix {
  const indent = ' '.repeat(usageColumn);
  const variableName = variable.name;

  const beforeCode = `${usageCode}`;
  const afterCode = `if (!${variableName})
{
    TC_LOG_ERROR("code_review", "Null pointer: ${variableName}");
    return;
}
${usageCode}`;

  return {
    type: 'add_null_check',
    file: file,
    line: usageLine,
    explanation: `Add null check for ${variableName} before dereferencing`,
    diff: `@@ -${usageLine},1 +${usageLine},6 @@
-${indent}${usageCode}
+${indent}if (!${variableName})
+${indent}{
+${indent}    TC_LOG_ERROR("code_review", "Null pointer: ${variableName}");
+${indent}    return;
+${indent}}
+${indent}${usageCode}`,
    codeSnippet: {
      before: beforeCode,
      after: afterCode,
    },
          confidence: 0.95,
    autoApplicable: true,
    estimatedImpact: 'low',
  };
}

// ============================================================================
// PLAYER POINTER RULES (40 RULES)
// ============================================================================

const RULE_PLAYER_GETGUID: CodeReviewRule = {
  id: 'null-safety-player-getguid',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::GetGUID() called without null check',
  description:
    'Player* pointers must be null-checked before calling GetGUID(). Dereferencing null Player* causes server crash.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetGUID']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->GetGUID()`
          );

          violations.push({
            ruleId: 'null-safety-player-getguid',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling GetGUID()`,
            explanation:
              `Calling GetGUID() on a null Player pointer will crash the server. ` +
              `Always null-check Player* pointers before calling methods.`,
            codeSnippet: {
              before: `${playerVar.name}->GetGUID()`,
            },
            suggestedFix: fix,
          confidence: 0.95,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 100,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => {
    return violation.suggestedFix!;
  },

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Player/Player.h:523',
  ],

  examples: [
    {
      bad: `void BotAI::DoSomething() {
    Player* bot = GetBot();
    ObjectGuid guid = bot->GetGUID();  // CRASH if bot is null
}`,
      good: `void BotAI::DoSomething() {
    Player* bot = GetBot();
    if (!bot)
    {
        TC_LOG_ERROR("playerbot", "Null bot pointer in DoSomething");
        return;
    }
    ObjectGuid guid = bot->GetGUID();  // Safe
}`,
      explanation:
        'Always null-check Player* pointers before calling methods. GetBot() can return nullptr.',
    },
  ],

  priority: 100,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.95,
};

const RULE_PLAYER_GETNAME: CodeReviewRule = {
  id: 'null-safety-player-getname',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::GetName() called without null check',
  description:
    'Player* pointers must be null-checked before calling GetName(). Dereferencing null Player* causes server crash.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetName']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->GetName()`
          );

          violations.push({
            ruleId: 'null-safety-player-getname',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling GetName()`,
            explanation:
              `Calling GetName() on a null Player pointer will crash the server. ` +
              `Player names are frequently accessed for logging but the pointer must be validated first.`,
            codeSnippet: {
              before: `${playerVar.name}->GetName()`,
            },
            suggestedFix: fix,
          confidence: 0.95,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 100,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Player/Player.h:894',
  ],

  examples: [
    {
      bad: `void LogBotAction() {
    Player* bot = FindBot();
    TC_LOG_INFO("playerbot", "Bot {} did action", bot->GetName());  // CRASH
}`,
      good: `void LogBotAction() {
    Player* bot = FindBot();
    if (!bot)
    {
        TC_LOG_ERROR("playerbot", "Null bot in LogBotAction");
        return;
    }
    TC_LOG_INFO("playerbot", "Bot {} did action", bot->GetName());  // Safe
}`,
      explanation:
        'Always validate Player* before accessing name, even for logging.',
    },
  ],

  priority: 100,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.95,
};

const RULE_PLAYER_CASTSPELL: CodeReviewRule = {
  id: 'null-safety-player-castspell',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::CastSpell() called without null check',
  description:
    'Player* pointers must be null-checked before calling CastSpell(). Null pointer dereference causes server crash.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['CastSpell']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->CastSpell(...)`
          );

          violations.push({
            ruleId: 'null-safety-player-castspell',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling CastSpell()`,
            explanation:
              `CastSpell() is one of the most frequently called methods and must have null protection. ` +
              `Bots disconnecting mid-cast can leave null pointers.`,
            codeSnippet: {
              before: `${playerVar.name}->CastSpell(...)`,
            },
            suggestedFix: fix,
          confidence: 0.98,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 100,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Unit/Unit.h:1543',
  ],

  examples: [
    {
      bad: `void CombatAI::CastHealSpell() {
    Player* bot = GetBot();
    bot->CastSpell(bot, SPELL_HEAL, true);  // CRASH if bot is null
}`,
      good: `void CombatAI::CastHealSpell() {
    Player* bot = GetBot();
    if (!bot || !bot->IsInWorld())
    {
        TC_LOG_ERROR("playerbot", "Cannot cast: bot is null or not in world");
        return;
    }
    bot->CastSpell(bot, SPELL_HEAL, true);  // Safe
}`,
      explanation:
        'CastSpell requires both null check AND IsInWorld() check for bot safety.',
    },
  ],

  priority: 100,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.98,
};

const RULE_PLAYER_TELEPORTTO: CodeReviewRule = {
  id: 'null-safety-player-teleportto',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::TeleportTo() called without null check',
  description:
    'Player* pointers must be null-checked before calling TeleportTo(). Null dereference during teleport causes crash.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['TeleportTo']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->TeleportTo(...)`
          );

          violations.push({
            ruleId: 'null-safety-player-teleportto',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling TeleportTo()`,
            explanation:
              `TeleportTo() accesses complex internal state and will crash on null pointer. ` +
              `Bots may disconnect during navigation, leaving null pointers.`,
            codeSnippet: {
              before: `${playerVar.name}->TeleportTo(...)`,
            },
            suggestedFix: fix,
          confidence: 0.97,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 100,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Player/Player.h:1854',
  ],

  examples: [
    {
      bad: `void NavigationAI::TeleportToLocation(uint32 mapId, float x, float y, float z) {
    Player* bot = GetBot();
    bot->TeleportTo(mapId, x, y, z, 0.0f);  // CRASH
}`,
      good: `void NavigationAI::TeleportToLocation(uint32 mapId, float x, float y, float z) {
    Player* bot = GetBot();
    if (!bot || !bot->IsInWorld())
        return;
    bot->TeleportTo(mapId, x, y, z, 0.0f);  // Safe
}`,
      explanation:
        'Teleportation requires validation of both pointer and world state.',
    },
  ],

  priority: 100,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.97,
};

const RULE_PLAYER_GETSESSION: CodeReviewRule = {
  id: 'null-safety-player-getsession',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::GetSession() called without null check',
  description:
    'Player* and WorldSession* pointers must both be null-checked. Bot players may not have sessions.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetSession']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->GetSession()`
          );

          violations.push({
            ruleId: 'null-safety-player-getsession',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling GetSession()`,
            explanation:
              `GetSession() can return nullptr for bot players. ALWAYS check both Player* and WorldSession*. ` +
              `This is a common crash point in bot code.`,
            codeSnippet: {
              before: `${playerVar.name}->GetSession()`,
            },
            suggestedFix: fix,
          confidence: 0.98,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 100,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Player/Player.h:1231',
  ],

  examples: [
    {
      bad: `void SendPacket(WorldPacket const* packet) {
    Player* bot = GetBot();
    bot->GetSession()->SendPacket(packet);  // DOUBLE CRASH RISK
}`,
      good: `void SendPacket(WorldPacket const* packet) {
    Player* bot = GetBot();
    if (!bot)
        return;

    WorldSession* session = bot->GetSession();
    if (!session)
        return;  // Bot players may not have sessions

    session->SendPacket(packet);  // Safe
}`,
      explanation:
        'CRITICAL: Bot players do NOT have WorldSession*. Always check both pointers.',
    },
  ],

  priority: 100,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.98,
};

const RULE_PLAYER_GETTARGET: CodeReviewRule = {
  id: 'null-safety-player-gettarget',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetTarget() result used without null check',
  description:
'GetTarget() returns Unit* which may be nullptr. Always validate before dereferencing.',
tags: [],
detector: (ast: AST, context: CodeContext): RuleViolation[] => {
const violations: RuleViolation[] = [];
const playerVars = findVariablesOfType(ast, 'Player');
for (const playerVar of playerVars) {
const calls = findMethodCallsOnVariable(ast, playerVar, ['GetTarget']);
for (const call of calls) {
// Check if the result is immediately dereferenced (e.g., ->method())
const lines = ast.root.raw.split('\n');
const usageLine = lines[call.line - 1];
// Look for pattern: GetTarget()->someMethod()
if (usageLine.includes('GetTarget()->') || usageLine.includes('GetTarget() ->')) {
const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);
if (!hasCheck) {
violations.push({
ruleId: 'null-safety-player-gettarget',
file: context.file,
line: call.line,
column: call.column,
severity: 'major',
message: `GetTarget() result dereferenced without null check`,
explanation:
`GetTarget() can return nullptr when player has no target. ` +
`Store the result and validate before use.`,
codeSnippet: {
before: usageLine.trim(),
},
suggestedFix: {
                type: 'add_null_check',
                file: context.file,
                line: call.line,
                explanation: 'Store GetTarget() result and validate',
                diff: `@@ -${call.line},1 +${call.line},3 @@
-${playerVar.name}->GetTarget()
+Unit* target = ${playerVar.name}->GetTarget();
+if (!target) return;
+// Use target safely`,
                codeSnippet: {
                  before: `${playerVar.name}->GetTarget()`,
                  after: `Unit* target = ${playerVar.name}->GetTarget();
if (!target) return;`,
                },
          confidence: 0.92,
                autoApplicable: true,
                estimatedImpact: 'low',
              },
          confidence: 0.92,
metadata: {
detectedBy: 'rule_engine',
category: 'null_safety',
priority: 90,
},
});
}
}
}
}
return violations;
},
fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
references: [
'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
'src/server/game/Entities/Unit/Unit.h:2187',
],
examples: [
{
bad: `void AttackTarget() {
Player* bot = GetBot();
bot->GetTarget()->GetGUID();  // CRASH if no target
}`,
good: `void AttackTarget() {
Player* bot = GetBot();
if (!bot)
return;
Unit* target = bot->GetTarget();
if (!target)
return;
ObjectGuid guid = target->GetGUID();  // Safe
}`,
explanation:
'GetTarget() can return nullptr. Store result and validate before use.',
},
],
priority: 90,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.92,
};
const RULE_PLAYER_GETVICTIM: CodeReviewRule = {
  id: 'null-safety-player-getvictim',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetVictim() result used without null check',
  description:
'GetVictim() returns Unit* which may be nullptr when not in combat. Always validate.',
tags: [],
detector: (ast: AST, context: CodeContext): RuleViolation[] => {
const violations: RuleViolation[] = [];
const playerVars = findVariablesOfType(ast, 'Player');
for (const playerVar of playerVars) {
const calls = findMethodCallsOnVariable(ast, playerVar, ['GetVictim']);
for (const call of calls) {
const lines = ast.root.raw.split('\n');
const usageLine = lines[call.line - 1];
if (usageLine.includes('GetVictim()->') || usageLine.includes('GetVictim() ->')) {
const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);
if (!hasCheck) {
violations.push({
ruleId: 'null-safety-player-getvictim',
file: context.file,
line: call.line,
column: call.column,
severity: 'major',
message: `GetVictim() result dereferenced without null check`,
explanation:
`GetVictim() returns nullptr when not in combat or victim died. ` +
`Combat AI must always validate victim pointer.`,
codeSnippet: {
before: usageLine.trim(),
},
suggestedFix: {
                type: 'add_null_check',
                file: context.file,
                line: call.line,
                explanation: 'Store GetVictim() result and validate',
                diff: `@@ -${call.line},1 +${call.line},3 @@
-${playerVar.name}->GetVictim()
+Unit* victim = ${playerVar.name}->GetVictim();
+if (!victim) return;
+// Use victim safely`,
                codeSnippet: {
                  before: `${playerVar.name}->GetVictim()`,
                  after: `Unit* victim = ${playerVar.name}->GetVictim();
if (!victim) return;`,
                },
          confidence: 0.93,
                autoApplicable: true,
                estimatedImpact: 'low',
              },
          confidence: 0.93,
metadata: {
detectedBy: 'rule_engine',
category: 'null_safety',
priority: 92,
},
});
}
}
}
}
return violations;
},
fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
references: [
'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
'src/server/game/Entities/Unit/Unit.h:2188',
],
examples: [
{
bad: `void DoCombatAction() {
Player* bot = GetBot();
float distance = bot->GetVictim()->GetDistance(bot);  // CRASH
}`,
good: `void DoCombatAction() {
Player* bot = GetBot();
if (!bot)
return;
Unit* victim = bot->GetVictim();
if (!victim || !victim->IsAlive())
return;
float distance = victim->GetDistance(bot);  // Safe
}`,
explanation:
'GetVictim() nullptr during combat transitions. Validate AND check IsAlive().',
},
],
priority: 92,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.93,
};
const RULE_PLAYER_GETMAP: CodeReviewRule = {
  id: 'null-safety-player-getmap',
  category: 'null_safety',
  severity: 'critical',
  title: 'Player::GetMap() called without null check',
  description:
    'Player::GetMap() requires null check on Player*. Map access without validation crashes server.',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetMap']);

      for (const call of calls) {
        const hasCheck = hasNullCheckInPath(ast, playerVar, call.line);

        if (!hasCheck) {
          const fix = generateNullCheckFix(
            context.file,
            playerVar,
            call.line,
            call.column,
            `${playerVar.name}->GetMap()`
          );

          violations.push({
            ruleId: 'null-safety-player-getmap',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Player pointer '${playerVar.name}' may be null when calling GetMap()`,
            explanation:
              `GetMap() is called frequently for position queries. ` +
              `Null pointer crashes are common during bot teleportation.`,
            codeSnippet: {
              before: `${playerVar.name}->GetMap()`,
            },
            suggestedFix: fix,
          confidence: 0.94,
            metadata: {
              detectedBy: 'rule_engine',
              category: 'null_safety',
              priority: 95,
            },
          });
        }
      }
    }

    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,

  references: [
    'https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130051/Null+Safety',
    'src/server/game/Entities/Object/Object.h:345',
  ],

  examples: [
    {
      bad: `void CheckMapLocation() {
    Player* bot = GetBot();
    Map* map = bot->GetMap();  // CRASH if bot is null
}`,
      good: `void CheckMapLocation() {
    Player* bot = GetBot();
    if (!bot || !bot->IsInWorld())
        return;

    Map* map = bot->GetMap();
    if (!map)
        return;

    // Use map safely
}`,
      explanation:
        'Validate both bot pointer AND IsInWorld() before accessing Map.',
    },
  ],

  priority: 95,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.94,
};

// Additional Player pointer method rules (32 more to reach 40 total)

const RULE_PLAYER_GETLEVEL: CodeReviewRule = {
  id: 'null-safety-player-getlevel',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetLevel() called without null check',
  description: 'Player* must be validated before calling GetLevel().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetLevel', 'getLevel']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-player-getlevel',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling GetLevel()`,
            explanation: 'Validate Player* before accessing level data.',
            codeSnippet: { before: `${playerVar.name}->GetLevel()` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->GetLevel()`),
          confidence: 0.91,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 85 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1456'],
  examples: [{
    bad: 'uint8 level = bot->GetLevel();  // CRASH',
    good: 'if (bot) { uint8 level = bot->GetLevel(); }',
    explanation: 'Check pointer before accessing level.',
  }],
  priority: 85,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.91,
};

const RULE_PLAYER_GETCLASS: CodeReviewRule = {
  id: 'null-safety-player-getclass',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetClass() called without null check',
  description: 'Player* must be validated before calling GetClass().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetClass', 'getClass']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-player-getclass',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling GetClass()`,
            explanation: 'Validate Player* before accessing class data.',
            codeSnippet: { before: `${playerVar.name}->GetClass()` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->GetClass()`),
          confidence: 0.91,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 85 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1458'],
  examples: [{
    bad: 'Classes cls = bot->GetClass();  // CRASH',
    good: 'if (bot) { Classes cls = bot->GetClass(); }',
    explanation: 'Check pointer before accessing class.',
  }],
  priority: 85,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.91,
};

const RULE_PLAYER_GETHEALTH: CodeReviewRule = {
  id: 'null-safety-player-gethealth',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetHealth() called without null check',
  description: 'Player* must be validated before calling GetHealth().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetHealth']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-player-gethealth',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling GetHealth()`,
            explanation: 'Health checks are critical for bot AI. Validate pointer first.',
            codeSnippet: { before: `${playerVar.name}->GetHealth()` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->GetHealth()`),
          confidence: 0.92,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 88 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1295'],
  examples: [{
    bad: 'uint32 hp = bot->GetHealth();  // CRASH',
    good: 'if (bot && bot->IsAlive()) { uint32 hp = bot->GetHealth(); }',
    explanation: 'Check both pointer and alive status.',
  }],
  priority: 88,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.92,
};

const RULE_PLAYER_GETPOWER: CodeReviewRule = {
  id: 'null-safety-player-getpower',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::GetPower() called without null check',
  description: 'Player* must be validated before calling GetPower().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['GetPower']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-player-getpower',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling GetPower()`,
            explanation: 'Power (mana/rage/energy) checks require pointer validation.',
            codeSnippet: { before: `${playerVar.name}->GetPower(POWER_MANA)` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->GetPower(...)`),
          confidence: 0.91,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 87 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1303'],
  examples: [{
    bad: 'uint32 mana = bot->GetPower(POWER_MANA);  // CRASH',
    good: 'if (bot) { uint32 mana = bot->GetPower(POWER_MANA); }',
    explanation: 'Check pointer before power queries.',
  }],
  priority: 87,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.91,
};

const RULE_PLAYER_ISALIVE: CodeReviewRule = {
  id: 'null-safety-player-isalive',
  category: 'null_safety',
  severity: 'major',
  title: 'Player::IsAlive() called without null check',
  description: 'Player* must be validated before calling IsAlive().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');

    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, ['IsAlive', 'isAlive']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-player-isalive',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling IsAlive()`,
            explanation: 'IsAlive() is commonly used but requires pointer validation first.',
            codeSnippet: { before: `${playerVar.name}->IsAlive()` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->IsAlive()`),
          confidence: 0.93,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 89 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1453'],
  examples: [{
    bad: 'if (bot->IsAlive()) { /* ... */ }  // CRASH if bot is null',
    good: 'if (bot && bot->IsAlive()) { /* ... */ }',
    explanation: 'Always check pointer before IsAlive().',
  }],
  priority: 89,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.93,
};

// Continue with remaining Player pointer rules...
// (For brevity, I'll add abbreviated versions of the remaining 27 rules)

const PLAYER_RULES_ABBREVIATED = [
  'GetRace', 'GetTeamId', 'GetMoney', 'SetMoney', 'GetItemByPos',
  'HasSpell', 'LearnSpell', 'RemoveSpell', 'GetGroup', 'GetGroupInvite',
  'IsInGroup', 'IsInRaid', 'GetGuildId', 'GetGuild', 'GetPosition',
  'GetPositionX', 'GetPositionY', 'GetPositionZ', 'GetOrientation',
  'IsInWorld', 'IsInCombat', 'GetZoneId', 'GetAreaId', 'GetMapId',
  'SendDirectMessage', 'SendPacket', 'IsMoving'
].map((methodName, index) => ({
  id: `null-safety-player-${methodName.toLowerCase()}`,
  category: 'null_safety' as const,
  severity: 'major' as const,
  title: `Player::${methodName}() called without null check`,
  description: `Player* must be validated before calling ${methodName}().`,
  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const playerVars = findVariablesOfType(ast, 'Player');
    for (const playerVar of playerVars) {
      const calls = findMethodCallsOnVariable(ast, playerVar, [methodName]);
      for (const call of calls) {
        if (!hasNullCheckInPath(ast, playerVar, call.line)) {
          violations.push({
            ruleId: `null-safety-player-${methodName.toLowerCase()}`,
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'major',
            message: `Player pointer '${playerVar.name}' may be null when calling ${methodName}()`,
            explanation: `Validate Player* before calling ${methodName}().`,
            codeSnippet: { before: `${playerVar.name}->${methodName}()` },
            suggestedFix: generateNullCheckFix(context.file, playerVar, call.line, call.column, `${playerVar.name}->${methodName}()`),
          confidence: 0.88,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 80 + index },
          });
        }
      }
    }
    return violations;
  },
  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: [`src/server/game/Entities/Player/Player.h`],
  examples: [{
    bad: `bot->${methodName}();  // CRASH`,
    good: `if (bot) { bot->${methodName}(); }`,
    explanation: `Check pointer before calling ${methodName}().`,
  }],
  priority: 80 + index,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.88,
}));

// ============================================================================
// UNIT POINTER RULES (50 RULES)
// ============================================================================

const RULE_UNIT_GETGUID: CodeReviewRule = {
  id: 'null-safety-unit-getguid',
  category: 'null_safety',
  severity: 'critical',
  title: 'Unit::GetGUID() called without null check',
  description: 'Unit* pointers must be null-checked before calling GetGUID().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const unitVars = findVariablesOfType(ast, 'Unit');

    for (const unitVar of unitVars) {
      const calls = findMethodCallsOnVariable(ast, unitVar, ['GetGUID']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, unitVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-unit-getguid',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Unit pointer '${unitVar.name}' may be null when calling GetGUID()`,
            explanation: 'Unit* from GetTarget(), ToUnit(), etc. can be nullptr.',
            codeSnippet: { before: `${unitVar.name}->GetGUID()` },
            suggestedFix: generateNullCheckFix(context.file, unitVar, call.line, call.column, `${unitVar.name}->GetGUID()`),
          confidence: 0.94,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 95 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Object/Object.h:211'],
  examples: [{
    bad: 'Unit* target = GetTarget();\nObjectGuid guid = target->GetGUID();  // CRASH',
    good: 'Unit* target = GetTarget();\nif (!target) return;\nObjectGuid guid = target->GetGUID();',
    explanation: 'GetTarget() can return nullptr. Always validate.',
  }],
  priority: 95,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.94,
};

const RULE_UNIT_CASTSPELL: CodeReviewRule = {
  id: 'null-safety-unit-castspell',
  category: 'null_safety',
  severity: 'critical',
  title: 'Unit::CastSpell() called without null check',
  description: 'Unit* pointers must be null-checked before calling CastSpell().',

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const unitVars = findVariablesOfType(ast, 'Unit');

    for (const unitVar of unitVars) {
      const calls = findMethodCallsOnVariable(ast, unitVar, ['CastSpell']);

      for (const call of calls) {
        if (!hasNullCheckInPath(ast, unitVar, call.line)) {
          violations.push({
            ruleId: 'null-safety-unit-castspell',
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `Unit pointer '${unitVar.name}' may be null when calling CastSpell()`,
            explanation: 'CastSpell on null Unit* crashes. Bots frequently cast spells on targets.',
            codeSnippet: { before: `${unitVar.name}->CastSpell(...)` },
            suggestedFix: generateNullCheckFix(context.file, unitVar, call.line, call.column, `${unitVar.name}->CastSpell(...)`),
          confidence: 0.96,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 98 },
          });
        }
      }
    }
    return violations;
  },

  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: ['src/server/game/Entities/Unit/Unit.h:1543'],
  examples: [{
    bad: 'Unit* target = bot->GetTarget();\ntarget->CastSpell(target, SPELL_ID, true);  // CRASH',
    good: 'Unit* target = bot->GetTarget();\nif (!target || !target->IsAlive()) return;\ntarget->CastSpell(target, SPELL_ID, true);',
    explanation: 'Validate target AND check IsAlive() before casting.',
  }],
  priority: 98,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.96,
};

// Additional Unit pointer method rules (48 more abbreviated for length)
const UNIT_RULES_ABBREVIATED = [
  'GetName', 'GetHealth', 'GetMaxHealth', 'GetPower', 'GetMaxPower',
  'IsAlive', 'IsDead', 'GetLevel', 'GetDistance', 'IsWithinDist',
  'IsInCombat', 'IsInCombatWith', 'Attack', 'AttackStop',
  'GetVictim', 'GetTarget', 'SetTarget', 'HasAura', 'AddAura', 'RemoveAura',
  'GetMap', 'GetZoneId', 'GetAreaId', 'GetPosition', 'GetPositionX',
  'GetPositionY', 'GetPositionZ', 'GetOrientation', 'IsMoving',
  'GetSpeedRate', 'IsHostileTo', 'IsFriendlyTo', 'CanSee',
  'IsInWater', 'IsUnderWater', 'IsFlying', 'GetCreatureType',
  'GetFaction', 'GetReactionTo', 'CanAttack', 'GetDisplayId',
  'GetNativeDisplayId', 'SetDisplayId', 'GetEntry', 'GetTypeId',
  'IsPlayer', 'IsCreature', 'ToCreature', 'ToPlayer'
].map((methodName, index) => ({
  id: `null-safety-unit-${methodName.toLowerCase()}`,
  category: 'null_safety' as const,
  severity: (index < 10 ? 'critical' : 'major') as IssueSeverity,
  title: `Unit::${methodName}() called without null check`,
  description: `Unit* must be validated before calling ${methodName}().`,
  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const unitVars = findVariablesOfType(ast, 'Unit');
    for (const unitVar of unitVars) {
      const calls = findMethodCallsOnVariable(ast, unitVar, [methodName]);
      for (const call of calls) {
        if (!hasNullCheckInPath(ast, unitVar, call.line)) {
          violations.push({
            ruleId: `null-safety-unit-${methodName.toLowerCase()}`,
            file: context.file,
            line: call.line,
            column: call.column,
            severity: index < 10 ? 'critical' : 'major',
            message: `Unit pointer '${unitVar.name}' may be null when calling ${methodName}()`,
            explanation: `Validate Unit* before calling ${methodName}().`,
            codeSnippet: { before: `${unitVar.name}->${methodName}()` },
            suggestedFix: generateNullCheckFix(context.file, unitVar, call.line, call.column, `${unitVar.name}->${methodName}()`),
          confidence: 0.90,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 90 - index },
          });
        }
      }
    }
    return violations;
  },
  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: [`src/server/game/Entities/Unit/Unit.h`],
  examples: [{
    bad: `unit->${methodName}();  // CRASH`,
    good: `if (unit) { unit->${methodName}(); }`,
    explanation: `Check pointer before calling ${methodName}().`,
  }],
  priority: 90 - index,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.90,
}));

// ============================================================================
// CREATURE POINTER RULES (40 RULES)
// ============================================================================

const CREATURE_METHODS = [
  'GetGUID', 'GetName', 'GetEntry', 'IsWorldBoss', 'IsDungeonBoss',
  'IsElite', 'IsRareElite', 'IsTrigger', 'IsCivilian', 'IsGuard',
  'CanWalk', 'CanSwim', 'CanFly', 'IsTrainer', 'IsVendor', 'IsQuestGiver',
  'IsGossip', 'IsTaxi', 'IsInnkeeper', 'IsRepairer', 'IsBattleMaster',
  'IsAuctioneer', 'IsBanker', 'GetCreatureTemplate', 'GetAIName',
  'GetScriptName', 'GetLootMode', 'SetLootMode', 'GetHomePosition',
  'SetHomePosition', 'GetRespawnDelay', 'SetRespawnDelay', 'GetCorpseDelay',
  'GetWanderDistance', 'GetWaypointPath', 'GetCurrentWaypointId',
  'GetTransportHomePosition', 'GetFormation', 'IsReturningHome', 'IsEvadingAttacks'
].map((methodName, index) => ({
  id: `null-safety-creature-${methodName.toLowerCase()}`,
  category: 'null_safety' as const,
  severity: (index < 8 ? 'critical' : 'major') as IssueSeverity,
  title: `Creature::${methodName}() called without null check`,
  description: `Creature* must be validated before calling ${methodName}().`,
  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const creatureVars = findVariablesOfType(ast, 'Creature');
    for (const creatureVar of creatureVars) {
      const calls = findMethodCallsOnVariable(ast, creatureVar, [methodName]);
      for (const call of calls) {
        if (!hasNullCheckInPath(ast, creatureVar, call.line)) {
          violations.push({
            ruleId: `null-safety-creature-${methodName.toLowerCase()}`,
            file: context.file,
            line: call.line,
            column: call.column,
            severity: index < 8 ? 'critical' : 'major',
            message: `Creature pointer '${creatureVar.name}' may be null when calling ${methodName}()`,
            explanation: `Validate Creature* before calling ${methodName}(). ToCreature() can return nullptr.`,
            codeSnippet: { before: `${creatureVar.name}->${methodName}()` },
            suggestedFix: generateNullCheckFix(context.file, creatureVar, call.line, call.column, `${creatureVar.name}->${methodName}()`),
          confidence: 0.89,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 85 - index },
          });
        }
      }
    }
    return violations;
  },
  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: [`src/server/game/Entities/Creature/Creature.h`],
  examples: [{
    bad: `Creature* creature = unit->ToCreature();\ncreature->${methodName}();  // CRASH`,
    good: `Creature* creature = unit->ToCreature();\nif (!creature) return;\ncreature->${methodName}();`,
    explanation: `ToCreature() can return nullptr. Always validate.`,
  }],
  priority: 85 - index,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.89,
}));

// ============================================================================
// GAMEOBJECT POINTER RULES (35 RULES)
// ============================================================================

const GAMEOBJECT_METHODS = [
  'GetGUID', 'GetEntry', 'GetGoType', 'GetGoState', 'SetGoState',
  'GetGoInfo', 'GetDisplayId', 'IsTransport', 'IsDestructibleBuilding',
  'GetRespawnTime', 'SetRespawnTime', 'Delete', 'SaveToDB', 'DeleteFromDB',
  'GetOwnerGUID', 'SetOwnerGUID', 'GetSpellId', 'IsSpawned', 'IsInUse',
  'SetInUse', 'GetLootState', 'SetLootState', 'AddUse', 'GetUseCount',
  'GetLootMode', 'SetLootMode', 'GetLinkedTrap', 'HasQuest', 'HasInvolvedQuest',
  'IsWithinDistInMap', 'GetGoArtKit', 'GetGoAnimProgress', 'SetGoAnimProgress',
  'SendGameObjectActivateAnimKit', 'UseDoorOrButton'
].map((methodName, index) => ({
  id: `null-safety-gameobject-${methodName.toLowerCase()}`,
  category: 'null_safety' as const,
  severity: (index < 6 ? 'critical' : 'major') as IssueSeverity,
  title: `GameObject::${methodName}() called without null check`,
  description: `GameObject* must be validated before calling ${methodName}().`,
  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const goVars = findVariablesOfType(ast, 'GameObject');
    for (const goVar of goVars) {
      const calls = findMethodCallsOnVariable(ast, goVar, [methodName]);
      for (const call of calls) {
        if (!hasNullCheckInPath(ast, goVar, call.line)) {
          violations.push({
            ruleId: `null-safety-gameobject-${methodName.toLowerCase()}`,
            file: context.file,
            line: call.line,
            column: call.column,
            severity: index < 6 ? 'critical' : 'major',
            message: `GameObject pointer '${goVar.name}' may be null when calling ${methodName}()`,
            explanation: `Validate GameObject* before calling ${methodName}().`,
            codeSnippet: { before: `${goVar.name}->${methodName}()` },
            suggestedFix: generateNullCheckFix(context.file, goVar, call.line, call.column, `${goVar.name}->${methodName}()`),
          confidence: 0.87,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 80 - index },
          });
        }
      }
    }
    return violations;
  },
  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: [`src/server/game/Entities/GameObject/GameObject.h`],
  examples: [{
    bad: `GameObject* go = GetGameObject();\ngo->${methodName}();  // CRASH`,
    good: `GameObject* go = GetGameObject();\nif (!go) return;\ngo->${methodName}();`,
    explanation: `GameObject retrieval methods can return nullptr.`,
  }],
  priority: 80 - index,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.87,
}));

// ============================================================================
// WORLDSESSION POINTER RULES (30 RULES)
// ============================================================================

const WORLDSESSION_METHODS = [
  'GetPlayer', 'GetPlayerGUID', 'SendPacket', 'SendAreaTriggerMessage',
  'SendNotification', 'GetSecurity', 'GetAccountId', 'GetBattlenetAccountId',
  'GetAccountName', 'LogoutPlayer', 'KickPlayer', 'InitWarden', 'IsLogingOut',
  'PlayerDisconnected', 'PlayerReconnected', 'GetLatency', 'SendAuthResponse',
  'SendAuthWaitQueue', 'GetSessionDbcLocale', 'GetSessionDbLocaleIndex',
  'GetTutorialInt', 'SetTutorialInt', 'HandlePlayerLoginCallback',
  'CanSpeak', 'UpdateSecurity', 'GetRecruiterId', 'IsARecruiter',
  'GetExpansion', 'GetRealmId', 'GetConnectToKey'
].map((methodName, index) => ({
  id: `null-safety-worldsession-${methodName.toLowerCase()}`,
  category: 'null_safety' as const,
  severity: 'critical' as const,
  title: `WorldSession::${methodName}() called without null check`,
  description: `WorldSession* must be validated. Bot players may not have sessions.`,
  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];
    const sessionVars = findVariablesOfType(ast, 'WorldSession');
    for (const sessionVar of sessionVars) {
      const calls = findMethodCallsOnVariable(ast, sessionVar, [methodName]);
      for (const call of calls) {
        if (!hasNullCheckInPath(ast, sessionVar, call.line)) {
          violations.push({
            ruleId: `null-safety-worldsession-${methodName.toLowerCase()}`,
            file: context.file,
            line: call.line,
            column: call.column,
            severity: 'critical',
            message: `WorldSession pointer '${sessionVar.name}' may be null when calling ${methodName}()`,
            explanation: `CRITICAL: Bot players do NOT have WorldSession*. Always validate.`,
            codeSnippet: { before: `${sessionVar.name}->${methodName}()` },
            suggestedFix: generateNullCheckFix(context.file, sessionVar, call.line, call.column, `${sessionVar.name}->${methodName}()`),
          confidence: 0.98,
            metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: 98 - index },
          });
        }
      }
    }
    return violations;
  },
  fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
  references: [`src/server/game/Server/WorldSession.h`],
  examples: [{
    bad: `WorldSession* session = player->GetSession();\nsession->${methodName}();  // CRASH for bots`,
    good: `WorldSession* session = player->GetSession();\nif (!session) return;  // Bot players have nullptr\nsession->${methodName}();`,
    explanation: `Bot players created without sessions WILL have nullptr here.`,
  }],
  priority: 98 - index,
  trinitySpecific: true,
  enabled: true,
          confidence: 0.98,
}));

// ============================================================================
// MISCELLANEOUS POINTER RULES (5 RULES)
// ============================================================================

const MISC_POINTER_RULES = [
  {
    id: 'null-safety-map-pointer',
    type: 'Map',
    methods: ['GetMapName', 'GetInstanceId', 'GetDifficulty', 'IsRaid', 'IsDungeon'],
    priority: 85,
  },
  {
    id: 'null-safety-group-pointer',
    type: 'Group',
    methods: ['GetMemberSlots', 'GetLeaderGUID', 'IsRaidGroup', 'IsBGGroup', 'IsBFGroup'],
    priority: 80,
  },
  {
    id: 'null-safety-guild-pointer',
    type: 'Guild',
    methods: ['GetName', 'GetLeaderGUID', 'GetMembersCount', 'GetMemberMGuid', 'GetLevel'],
    priority: 75,
  },
  {
    id: 'null-safety-spell-pointer',
    type: 'Spell',
    methods: ['GetSpellInfo', 'GetCastTime', 'GetDuration', 'Cancel', 'finish'],
    priority: 82,
  },
  {
    id: 'null-safety-aura-pointer',
    type: 'Aura',
    methods: ['GetId', 'GetDuration', 'GetMaxDuration', 'GetStackAmount', 'SetStackAmount'],
    priority: 78,
  },
].flatMap((rule, ruleIndex) =>
  rule.methods.map((methodName, methodIndex) => ({
    id: `${rule.id}-${methodName.toLowerCase()}`,
    category: 'null_safety' as const,
    severity: 'major' as const,
    title: `${rule.type}::${methodName}() called without null check`,
    description: `${rule.type}* must be validated before calling ${methodName}().`,
    tags: [],
    detector: (ast: AST, context: CodeContext): RuleViolation[] => {
      const violations: RuleViolation[] = [];
      const vars = findVariablesOfType(ast, rule.type);
      for (const varSymbol of vars) {
        const calls = findMethodCallsOnVariable(ast, varSymbol, [methodName]);
        for (const call of calls) {
          if (!hasNullCheckInPath(ast, varSymbol, call.line)) {
            violations.push({
              ruleId: `${rule.id}-${methodName.toLowerCase()}`,
              file: context.file,
              line: call.line,
              column: call.column,
              severity: 'major',
              message: `${rule.type} pointer '${varSymbol.name}' may be null when calling ${methodName}()`,
              explanation: `Validate ${rule.type}* before calling ${methodName}().`,
              codeSnippet: { before: `${varSymbol.name}->${methodName}()` },
              suggestedFix: generateNullCheckFix(context.file, varSymbol, call.line, call.column, `${varSymbol.name}->${methodName}()`),
          confidence: 0.86,
              metadata: { detectedBy: 'rule_engine', category: 'null_safety', priority: rule.priority - methodIndex },
            });
          }
        }
      }
      return violations;
    },
    fixer: (violation: RuleViolation): CodeFix => violation.suggestedFix!,
    references: [`src/server/game/`],
    examples: [{
      bad: `${rule.type.toLowerCase()}->${methodName}();  // CRASH`,
      good: `if (${rule.type.toLowerCase()}) { ${rule.type.toLowerCase()}->${methodName}(); }`,
      explanation: `Check ${rule.type}* pointer before calling ${methodName}().`,
    }],
    priority: rule.priority - methodIndex,
    trinitySpecific: true,
    enabled: true,
          confidence: 0.86,
  }))
);

// ============================================================================
// EXPORTS
// ============================================================================

export const NULL_SAFETY_RULES: CodeReviewRule[] = [
  // Player pointer rules (40 total)
  RULE_PLAYER_GETGUID,
  RULE_PLAYER_GETNAME,
  RULE_PLAYER_CASTSPELL,
  RULE_PLAYER_TELEPORTTO,
  RULE_PLAYER_GETSESSION,
  RULE_PLAYER_GETTARGET,
  RULE_PLAYER_GETVICTIM,
  RULE_PLAYER_GETMAP,
  RULE_PLAYER_GETLEVEL,
  RULE_PLAYER_GETCLASS,
  RULE_PLAYER_GETHEALTH,
  RULE_PLAYER_GETPOWER,
  RULE_PLAYER_ISALIVE,
  ...PLAYER_RULES_ABBREVIATED,

  // Unit pointer rules (50 total)
  RULE_UNIT_GETGUID,
  RULE_UNIT_CASTSPELL,
  ...UNIT_RULES_ABBREVIATED,

  // Creature pointer rules (40 total)
  ...CREATURE_METHODS,

  // GameObject pointer rules (35 total)
  ...GAMEOBJECT_METHODS,

  // WorldSession pointer rules (30 total)
  ...WORLDSESSION_METHODS,

  // Miscellaneous pointer rules (5 total = 25 method rules)
  ...MISC_POINTER_RULES,
];

// Verification: Count rules
const NULL_SAFETY_RULE_COUNT = NULL_SAFETY_RULES.length;
logger.info(`Null Safety Rules loaded: ${NULL_SAFETY_RULE_COUNT} rules`);
logger.info(`Target: 200 rules, Current: ${NULL_SAFETY_RULE_COUNT} (${((NULL_SAFETY_RULE_COUNT / 200) * 100).toFixed(1)}%)`);
