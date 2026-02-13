/**
 * C++ Test Generator API Route
 *
 * Provides HTTP endpoints for the C++ Test Generator engine.
 * Bridges between the Web UI and MCP C++ test generation tools.
 *
 * GET /api/cpp-test-gen?action=<action>&params...
 * POST /api/cpp-test-gen (for test generation)
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// MOCK DATA - Used when MCP server is not connected
// ============================================================================

const MOCK_SAMPLE_SOURCE = `#include "Player.h"
#include "Spell.h"

class SpellManager {
public:
    SpellManager();
    ~SpellManager();

    bool CastSpell(uint32 spellId, Unit* target);
    float CalculateDamage(uint32 spellId, uint32 level) const;
    void RemoveAura(uint32 auraId);
    const SpellInfo* GetSpellInfo(uint32 spellId) const;
    int32 GetCooldownRemaining(uint32 spellId) const;

private:
    std::map<uint32, SpellInfo*> _spellMap;
    uint32 _ownerId;
};

bool IsValidSpellTarget(Unit* caster, Unit* target, uint32 spellId);
float GetSpellRange(uint32 spellId);
uint32 CalculateSpellCost(uint32 spellId, uint32 level);`;

const MOCK_ANALYSIS = {
  filePath: "src/server/game/Spells/SpellManager.h",
  totalLines: 28,
  testableItems: 8,
  includes: ["Player.h", "Spell.h"],
  namespaces: [],
  defines: [],
  enums: [],
  classes: [
    {
      name: "SpellManager",
      baseClasses: [],
      isAbstract: false,
      methodCount: 4,
      constructorCount: 1,
      memberVariableCount: 2,
      methods: [
        { name: "CastSpell", returnType: "bool", paramCount: 2, isConst: false, isStatic: false, isVirtual: false, complexity: 1, lineNumber: 9 },
        { name: "CalculateDamage", returnType: "float", paramCount: 2, isConst: true, isStatic: false, isVirtual: false, complexity: 1, lineNumber: 10 },
        { name: "RemoveAura", returnType: "void", paramCount: 1, isConst: false, isStatic: false, isVirtual: false, complexity: 1, lineNumber: 11 },
        { name: "GetSpellInfo", returnType: "const SpellInfo*", paramCount: 1, isConst: true, isStatic: false, isVirtual: false, complexity: 1, lineNumber: 12 },
      ],
      lineNumber: 4,
    },
  ],
  freeFunctions: [
    { name: "IsValidSpellTarget", returnType: "bool", paramCount: 3, parameters: [{ name: "caster", type: "Unit", isPointer: true, isReference: false, isConst: false }, { name: "target", type: "Unit", isPointer: true, isReference: false, isConst: false }, { name: "spellId", type: "uint32", isPointer: false, isReference: false, isConst: false }], isStatic: false, complexity: 1, lineNumber: 21 },
    { name: "GetSpellRange", returnType: "float", paramCount: 1, parameters: [{ name: "spellId", type: "uint32", isPointer: false, isReference: false, isConst: false }], isStatic: false, complexity: 1, lineNumber: 22 },
    { name: "CalculateSpellCost", returnType: "uint32", paramCount: 2, parameters: [{ name: "spellId", type: "uint32", isPointer: false, isReference: false, isConst: false }, { name: "level", type: "uint32", isPointer: false, isReference: false, isConst: false }], isStatic: false, complexity: 1, lineNumber: 23 },
  ],
};

const MOCK_TEST_CASES = [
  { testName: "CastSpell_BasicCall", testSuite: "SpellManagerTest", targetFunction: "SpellManager::CastSpell", testType: "unit", description: "Verify CastSpell executes without error", priority: "high" },
  { testName: "CastSpell_NullTarget", testSuite: "SpellManagerTest", targetFunction: "SpellManager::CastSpell", testType: "null_check", description: "Test CastSpell with nullptr target", priority: "critical" },
  { testName: "CastSpell_ZeroSpellId", testSuite: "SpellManagerTest", targetFunction: "SpellManager::CastSpell", testType: "boundary", description: "Test CastSpell with spellId = 0", priority: "medium" },
  { testName: "CalculateDamage_BasicCall", testSuite: "SpellManagerTest", targetFunction: "SpellManager::CalculateDamage", testType: "unit", description: "Verify CalculateDamage returns expected type", priority: "high" },
  { testName: "CalculateDamage_ConstCorrectness", testSuite: "SpellManagerTest", targetFunction: "SpellManager::CalculateDamage", testType: "unit", description: "Verify CalculateDamage works on const instance", priority: "medium" },
  { testName: "RemoveAura_BasicCall", testSuite: "SpellManagerTest", targetFunction: "SpellManager::RemoveAura", testType: "unit", description: "Verify RemoveAura executes without error", priority: "high" },
  { testName: "GetSpellInfo_BasicCall", testSuite: "SpellManagerTest", targetFunction: "SpellManager::GetSpellInfo", testType: "unit", description: "Verify GetSpellInfo returns valid pointer", priority: "high" },
  { testName: "IsValidSpellTarget_NullCaster", testSuite: "SpellManagerTest", targetFunction: "IsValidSpellTarget", testType: "null_check", description: "Test IsValidSpellTarget with nullptr caster", priority: "critical" },
  { testName: "IsValidSpellTarget_NullTarget", testSuite: "SpellManagerTest", targetFunction: "IsValidSpellTarget", testType: "null_check", description: "Test IsValidSpellTarget with nullptr target", priority: "critical" },
  { testName: "GetSpellRange_BasicCall", testSuite: "SpellManagerTest", targetFunction: "GetSpellRange", testType: "unit", description: "Verify GetSpellRange returns valid range", priority: "high" },
  { testName: "CalculateSpellCost_ZeroLevel", testSuite: "SpellManagerTest", targetFunction: "CalculateSpellCost", testType: "boundary", description: "Test CalculateSpellCost with level = 0", priority: "medium" },
  { testName: "CalculateSpellCost_MaxLevel", testSuite: "SpellManagerTest", targetFunction: "CalculateSpellCost", testType: "boundary", description: "Test CalculateSpellCost with max level", priority: "low" },
];

const MOCK_STATS = {
  totalTests: 12,
  unitTests: 6,
  boundaryTests: 3,
  nullCheckTests: 3,
  exceptionTests: 0,
};

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    switch (action) {
      case "sample-source":
        return NextResponse.json({
          source: MOCK_SAMPLE_SOURCE,
          filePath: "src/server/game/Spells/SpellManager.h",
          description: "Sample SpellManager class with free functions for demonstration",
        });

      case "analysis":
        return NextResponse.json({
          analysis: MOCK_ANALYSIS,
        });

      case "recent-generations":
        return NextResponse.json({
          generations: [
            {
              id: "gen_1",
              filePath: "src/server/game/Spells/SpellManager.h",
              testSuite: "SpellManagerTest",
              testCount: 12,
              generatedAt: new Date(Date.now() - 3600000).toISOString(),
              stats: MOCK_STATS,
            },
            {
              id: "gen_2",
              filePath: "src/server/game/Entities/Player/Player.h",
              testSuite: "PlayerTest",
              testCount: 28,
              generatedAt: new Date(Date.now() - 7200000).toISOString(),
              stats: { totalTests: 28, unitTests: 14, boundaryTests: 8, nullCheckTests: 4, exceptionTests: 2 },
            },
            {
              id: "gen_3",
              filePath: "src/server/game/AI/CreatureAI.h",
              testSuite: "CreatureAITest",
              testCount: 18,
              generatedAt: new Date(Date.now() - 10800000).toISOString(),
              stats: { totalTests: 18, unitTests: 10, boundaryTests: 3, nullCheckTests: 5, exceptionTests: 0 },
            },
          ],
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: sample-source, analysis, recent-generations` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "generate-tests":
        return NextResponse.json({
          fileName: "test_SpellManager.cpp",
          testSuite: "SpellManagerTest",
          sourceFile: body.filePath ?? "unknown.cpp",
          stats: MOCK_STATS,
          cmakeEntry: `add_executable(SpellManagerTest test_SpellManager.cpp)\ntarget_link_libraries(SpellManagerTest PRIVATE gtest gtest_main)\nadd_test(NAME SpellManagerTest COMMAND SpellManagerTest)`,
          testCases: MOCK_TEST_CASES,
          generatedAt: new Date().toISOString(),
        });

      case "analyze-source":
        return NextResponse.json({
          analysis: MOCK_ANALYSIS,
          analyzedAt: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: generate-tests, analyze-source` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
