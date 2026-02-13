/**
 * Unit tests for the C++ Test Generator
 *
 * Tests the C++ source parser, test case generator, and report exporter.
 * Verifies handling of classes, free functions, enums, constructors,
 * and various parameter types.
 */

import {
  analyzeCppSource,
  generateTestCases,
  generateCppTests,
  exportTestGenMarkdown,
  type CppFileAnalysis,
  type CppFunction,
  type CppClass,
  type GeneratedTestFile,
  type TestGenConfig,
} from "../../src/tools/cpptestgenerator";

// ============================================================================
// Test Source Fixtures
// ============================================================================

const SIMPLE_FUNCTION_SOURCE = `
#include "Common.h"

int Add(int a, int b);
float GetDistance(float x, float y);
void DoSomething();
`;

const CLASS_SOURCE = `
#include "Object.h"
#include "Map.h"

class SpellManager : public Object {
public:
    SpellManager();
    ~SpellManager();

    bool CastSpell(uint32 spellId, Unit* target);
    float CalculateDamage(uint32 spellId, uint32 level) const;
    void RemoveAura(uint32 auraId);
    const SpellInfo* GetSpellInfo(uint32 spellId) const;

private:
    std::map<uint32, SpellInfo*> _spellMap;
    uint32 _ownerId;
};
`;

const MULTI_CLASS_SOURCE = `
#include "Unit.h"

class BaseAI {
public:
    virtual void Update(uint32 diff) = 0;
    virtual void Reset();
};

class CreatureAI : public BaseAI {
public:
    CreatureAI(Creature* creature);

    void Update(uint32 diff) override;
    void Reset() override;
    bool IsWithinRange(Unit* target, float range) const;
    void MoveTo(float x, float y, float z);

private:
    Creature* _creature;
};
`;

const ENUM_SOURCE = `
#include "Define.h"

enum SpellSchool {
    SPELL_SCHOOL_NORMAL = 0,
    SPELL_SCHOOL_HOLY = 1,
    SPELL_SCHOOL_FIRE = 2,
    SPELL_SCHOOL_NATURE = 3,
    SPELL_SCHOOL_FROST = 4,
    SPELL_SCHOOL_SHADOW = 5,
    SPELL_SCHOOL_ARCANE = 6
};

enum class AuraType : uint8 {
    None = 0,
    PeriodicDamage = 1,
    PeriodicHeal = 2
};
`;

const DEFINE_SOURCE = `
#define MAX_LEVEL 80
#define SPELL_SCHOOL_MASK_ALL 0x7F
`;

const STATIC_VIRTUAL_SOURCE = `
class Singleton {
public:
    static Singleton& Instance();
    static int GetCount();
    virtual void Process(uint32 diff);
    void DoWork(int32 amount) const;
};
`;

const COMPLEX_PARAMS_SOURCE = `
void ProcessData(const std::string& name, uint32* outCount, int8_t flags = 0);
bool ValidateInput(const std::vector<uint32>& ids, float* result);
uint64 ComputeHash(const char* data, size_t length);
`;

const NAMESPACE_SOURCE = `
namespace Trinity {
namespace Game {

class Player {
public:
    void SetLevel(uint32 level);
};

} // namespace Game
} // namespace Trinity
`;

const EMPTY_SOURCE = `// Empty file with just a comment`;

// ============================================================================
// analyzeCppSource Tests
// ============================================================================

describe("analyzeCppSource", () => {
  describe("include parsing", () => {
    it("should extract include paths", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "test.h");
      expect(analysis.includes).toContain("Common.h");
    });

    it("should extract multiple includes", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "test.h");
      expect(analysis.includes).toContain("Object.h");
      expect(analysis.includes).toContain("Map.h");
    });

    it("should handle empty source", () => {
      const analysis = analyzeCppSource(EMPTY_SOURCE, "empty.h");
      expect(analysis.includes).toHaveLength(0);
    });
  });

  describe("namespace parsing", () => {
    it("should extract namespaces", () => {
      const analysis = analyzeCppSource(NAMESPACE_SOURCE, "ns.h");
      expect(analysis.namespaces).toContain("Trinity");
      expect(analysis.namespaces).toContain("Game");
    });

    it("should deduplicate namespaces", () => {
      const src = `namespace Foo { } namespace Foo { }`;
      const analysis = analyzeCppSource(src, "test.h");
      expect(analysis.namespaces.filter(n => n === "Foo")).toHaveLength(1);
    });
  });

  describe("enum parsing", () => {
    it("should parse regular enums", () => {
      const analysis = analyzeCppSource(ENUM_SOURCE, "enums.h");
      const spellSchool = analysis.enums.find(e => e.name === "SpellSchool");
      expect(spellSchool).toBeDefined();
      expect(spellSchool!.isClass).toBe(false);
      expect(spellSchool!.values.length).toBeGreaterThanOrEqual(6);
    });

    it("should parse enum class", () => {
      const analysis = analyzeCppSource(ENUM_SOURCE, "enums.h");
      const auraType = analysis.enums.find(e => e.name === "AuraType");
      expect(auraType).toBeDefined();
      expect(auraType!.isClass).toBe(true);
    });

    it("should extract enum values with assignments", () => {
      const analysis = analyzeCppSource(ENUM_SOURCE, "enums.h");
      const spellSchool = analysis.enums.find(e => e.name === "SpellSchool");
      expect(spellSchool).toBeDefined();
      const holy = spellSchool!.values.find(v => v.name === "SPELL_SCHOOL_HOLY");
      expect(holy).toBeDefined();
      expect(holy!.value).toBe("1");
    });
  });

  describe("define parsing", () => {
    it("should parse #define macros", () => {
      const analysis = analyzeCppSource(DEFINE_SOURCE, "defines.h");
      expect(analysis.defines.length).toBeGreaterThanOrEqual(2);
      const maxLevel = analysis.defines.find(d => d.name === "MAX_LEVEL");
      expect(maxLevel).toBeDefined();
      expect(maxLevel!.value).toBe("80");
    });
  });

  describe("class parsing", () => {
    it("should parse class with base class", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      expect(cls).toBeDefined();
      expect(cls!.baseClasses).toContain("Object");
    });

    it("should parse class constructors", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      expect(cls).toBeDefined();
      expect(cls!.constructors.length).toBeGreaterThanOrEqual(1);
    });

    it("should parse class methods", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      expect(cls).toBeDefined();
      expect(cls!.methods.length).toBeGreaterThanOrEqual(3);
    });

    it("should detect abstract classes", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const baseAI = analysis.classes.find(c => c.name === "BaseAI");
      expect(baseAI).toBeDefined();
      expect(baseAI!.isAbstract).toBe(true);
    });

    it("should detect non-abstract classes", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const creatureAI = analysis.classes.find(c => c.name === "CreatureAI");
      expect(creatureAI).toBeDefined();
      expect(creatureAI!.isAbstract).toBe(false);
    });
  });

  describe("free function parsing", () => {
    it("should parse free functions", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      expect(analysis.freeFunctions.length).toBeGreaterThanOrEqual(2);
    });

    it("should parse function with void return", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const doSomething = analysis.freeFunctions.find(f => f.name === "DoSomething");
      expect(doSomething).toBeDefined();
    });

    it("should parse function parameters", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const add = analysis.freeFunctions.find(f => f.name === "Add");
      expect(add).toBeDefined();
      expect(add!.parameters.length).toBe(2);
    });
  });

  describe("method property detection", () => {
    it("should detect const methods", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      const calcDamage = cls?.methods.find(m => m.name === "CalculateDamage");
      expect(calcDamage?.isConst).toBe(true);
    });

    it("should detect non-const methods", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      const castSpell = cls?.methods.find(m => m.name === "CastSpell");
      expect(castSpell?.isConst).toBe(false);
    });

    it("should detect virtual methods", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const baseAI = analysis.classes.find(c => c.name === "BaseAI");
      const update = baseAI?.methods.find(m => m.name === "Update");
      expect(update?.isVirtual).toBe(true);
    });

    it("should detect override methods", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const creatureAI = analysis.classes.find(c => c.name === "CreatureAI");
      const update = creatureAI?.methods.find(m => m.name === "Update");
      expect(update?.isOverride).toBe(true);
    });

    it("should detect static methods", () => {
      const analysis = analyzeCppSource(STATIC_VIRTUAL_SOURCE, "singleton.h");
      const cls = analysis.classes.find(c => c.name === "Singleton");
      const getCount = cls?.methods.find(m => m.name === "GetCount");
      expect(getCount?.isStatic).toBe(true);
    });
  });

  describe("parameter parsing", () => {
    it("should detect pointer parameters", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const cls = analysis.classes.find(c => c.name === "SpellManager");
      const castSpell = cls?.methods.find(m => m.name === "CastSpell");
      expect(castSpell).toBeDefined();
      const targetParam = castSpell!.parameters.find(p => p.isPointer);
      expect(targetParam).toBeDefined();
    });

    it("should detect const reference parameters", () => {
      const analysis = analyzeCppSource(COMPLEX_PARAMS_SOURCE, "complex.h");
      const processData = analysis.freeFunctions.find(f => f.name === "ProcessData");
      expect(processData).toBeDefined();
      const nameParam = processData!.parameters.find(p => p.isConst && p.isReference);
      expect(nameParam).toBeDefined();
    });

    it("should detect default parameter values", () => {
      const analysis = analyzeCppSource(COMPLEX_PARAMS_SOURCE, "complex.h");
      const processData = analysis.freeFunctions.find(f => f.name === "ProcessData");
      expect(processData).toBeDefined();
      const flagsParam = processData!.parameters.find(p => p.defaultValue !== undefined);
      expect(flagsParam).toBeDefined();
      expect(flagsParam!.defaultValue).toBe("0");
    });
  });

  describe("testable items count", () => {
    it("should count free functions as testable", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      expect(analysis.testableItems).toBeGreaterThanOrEqual(2);
    });

    it("should count class methods and constructors as testable", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      expect(analysis.testableItems).toBeGreaterThanOrEqual(4);
    });

    it("should return 0 for empty source", () => {
      const analysis = analyzeCppSource(EMPTY_SOURCE, "empty.h");
      expect(analysis.testableItems).toBe(0);
    });
  });

  describe("file metadata", () => {
    it("should record file path", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "my/file.h");
      expect(analysis.filePath).toBe("my/file.h");
    });

    it("should count total lines", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      expect(analysis.totalLines).toBe(SIMPLE_FUNCTION_SOURCE.split("\n").length);
    });
  });
});

// ============================================================================
// generateTestCases Tests
// ============================================================================

describe("generateTestCases", () => {
  describe("basic test generation", () => {
    it("should generate tests for free functions", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.testCases.length).toBeGreaterThan(0);
    });

    it("should generate tests for class methods", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.testCases.length).toBeGreaterThan(0);
    });

    it("should skip abstract classes", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const result = generateTestCases(analysis);
      const baseAITests = result.testCases.filter(tc => tc.testSuite === "BaseAITest");
      expect(baseAITests).toHaveLength(0);
    });

    it("should generate non-abstract class tests", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const result = generateTestCases(analysis);
      const creatureAITests = result.testCases.filter(tc => tc.testSuite === "CreatureAITest");
      expect(creatureAITests.length).toBeGreaterThan(0);
    });
  });

  describe("test types", () => {
    it("should generate BasicCall unit tests", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      const basicTests = result.testCases.filter(tc => tc.testName.includes("BasicCall"));
      expect(basicTests.length).toBeGreaterThan(0);
    });

    it("should generate ReturnsExpectedType tests for non-void functions", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      const returnTests = result.testCases.filter(tc => tc.testName.includes("ReturnsExpectedType"));
      expect(returnTests.length).toBeGreaterThan(0);
    });

    it("should not generate return type tests for void functions", () => {
      const analysis = analyzeCppSource("void DoNothing();", "void.h");
      const result = generateTestCases(analysis);
      const returnTests = result.testCases.filter(tc => tc.testName.includes("ReturnsExpectedType"));
      expect(returnTests).toHaveLength(0);
    });

    it("should generate null check tests for pointer params", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      const nullTests = result.testCases.filter(tc => tc.testType === "null_check");
      expect(nullTests.length).toBeGreaterThan(0);
    });

    it("should generate boundary tests for numeric params", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      const boundaryTests = result.testCases.filter(tc => tc.testType === "boundary");
      expect(boundaryTests.length).toBeGreaterThan(0);
    });

    it("should generate const correctness tests for const methods", () => {
      const analysis = analyzeCppSource(STATIC_VIRTUAL_SOURCE, "singleton.h");
      const result = generateTestCases(analysis);
      const constTests = result.testCases.filter(tc => tc.testName.includes("ConstCorrectness"));
      expect(constTests.length).toBeGreaterThan(0);
    });
  });

  describe("constructor tests", () => {
    it("should generate default constructor test", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      const ctorTests = result.testCases.filter(tc => tc.testName.includes("Constructor"));
      expect(ctorTests.length).toBeGreaterThan(0);
    });

    it("should generate parameterized constructor test", () => {
      const analysis = analyzeCppSource(MULTI_CLASS_SOURCE, "ai.h");
      const result = generateTestCases(analysis);
      const ctorTests = result.testCases.filter(tc => tc.testName.includes("Constructor"));
      expect(ctorTests.length).toBeGreaterThan(0);
    });
  });

  describe("config options", () => {
    it("should skip boundary tests when includeEdgeCases is false", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis, { includeEdgeCases: false });
      const boundaryTests = result.testCases.filter(tc => tc.testType === "boundary");
      expect(boundaryTests).toHaveLength(0);
    });

    it("should skip null tests when includeNullChecks is false", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis, { includeNullChecks: false });
      const nullTests = result.testCases.filter(tc => tc.testType === "null_check");
      expect(nullTests).toHaveLength(0);
    });

    it("should still generate unit tests when options are disabled", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis, { includeEdgeCases: false, includeNullChecks: false });
      const unitTests = result.testCases.filter(tc => tc.testType === "unit");
      expect(unitTests.length).toBeGreaterThan(0);
    });
  });

  describe("output structure", () => {
    it("should produce correct file name", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.fileName).toBe("test_funcs.cpp");
    });

    it("should produce correct test suite name", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.testSuite).toBe("funcsTest");
    });

    it("should handle path separators in file name", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "src/game/Player.cpp");
      const result = generateTestCases(analysis);
      expect(result.fileName).toBe("test_Player.cpp");
      expect(result.testSuite).toBe("PlayerTest");
    });

    it("should include gtest include in includes", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.includes).toContain("<gtest/gtest.h>");
    });

    it("should include source file in includes", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.includes).toContain('"funcs.h"');
    });

    it("should produce CMake entry", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.cmakeEntry).toContain("add_executable");
      expect(result.cmakeEntry).toContain("gtest");
      expect(result.cmakeEntry).toContain("add_test");
    });

    it("should produce valid stats", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.stats.totalTests).toBe(result.testCases.length);
      expect(result.stats.unitTests + result.stats.boundaryTests + result.stats.nullCheckTests + result.stats.exceptionTests).toBeLessThanOrEqual(result.stats.totalTests);
    });

    it("should generate class fixtures", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.fixtures.length).toBeGreaterThan(0);
      expect(result.fixtures[0]).toContain("::testing::Test");
    });
  });

  describe("full content generation", () => {
    it("should produce non-empty content", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.fullContent.length).toBeGreaterThan(100);
    });

    it("should include header comment", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.fullContent).toContain("Auto-generated test file");
    });

    it("should include TEST or TEST_F macros", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.fullContent).toMatch(/TEST(_F)?\(/);
    });

    it("should use TEST_F for class methods", () => {
      const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
      const result = generateTestCases(analysis);
      expect(result.fullContent).toContain("TEST_F(");
    });

    it("should include EXPECT macros in test code", () => {
      const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
      const result = generateTestCases(analysis);
      expect(result.fullContent).toContain("EXPECT_");
    });
  });
});

// ============================================================================
// generateCppTests (convenience function) Tests
// ============================================================================

describe("generateCppTests", () => {
  it("should combine analysis and generation in one call", () => {
    const result = generateCppTests(CLASS_SOURCE, "spell.h");
    expect(result.testCases.length).toBeGreaterThan(0);
    expect(result.sourceFile).toBe("spell.h");
  });

  it("should respect config overrides", () => {
    const result = generateCppTests(CLASS_SOURCE, "spell.h", { includeNullChecks: false });
    const nullTests = result.testCases.filter(tc => tc.testType === "null_check");
    expect(nullTests).toHaveLength(0);
  });

  it("should produce same results as separate calls", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const separateResult = generateTestCases(analysis);
    const combinedResult = generateCppTests(CLASS_SOURCE, "spell.h");
    expect(combinedResult.testCases.length).toBe(separateResult.testCases.length);
  });
});

// ============================================================================
// exportTestGenMarkdown Tests
// ============================================================================

describe("exportTestGenMarkdown", () => {
  let result: GeneratedTestFile;

  beforeAll(() => {
    result = generateCppTests(CLASS_SOURCE, "spell.h");
  });

  it("should produce markdown report", () => {
    const md = exportTestGenMarkdown(result);
    expect(md.length).toBeGreaterThan(0);
  });

  it("should include report title", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("# C++ Test Generation Report");
  });

  it("should include source file reference", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("spell.h");
  });

  it("should include test statistics table", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("| Type | Count |");
    expect(md).toContain("Unit Tests");
    expect(md).toContain("Boundary Tests");
    expect(md).toContain("Null Check Tests");
  });

  it("should include CMake section", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("## CMake Integration");
    expect(md).toContain("add_executable");
  });

  it("should include test case table", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("| # | Test Name | Type | Priority | Description |");
  });

  it("should include generated code block", () => {
    const md = exportTestGenMarkdown(result);
    expect(md).toContain("## Generated Test File");
    expect(md).toContain("```cpp");
  });

  it("should list all test cases in table", () => {
    const md = exportTestGenMarkdown(result);
    for (const tc of result.testCases) {
      expect(md).toContain(tc.testName);
    }
  });
});

// ============================================================================
// Edge Cases & Robustness Tests
// ============================================================================

describe("edge cases", () => {
  it("should handle source with no functions or classes", () => {
    const analysis = analyzeCppSource("#include <iostream>\n", "empty.h");
    expect(analysis.testableItems).toBe(0);
    const result = generateTestCases(analysis);
    expect(result.testCases).toHaveLength(0);
  });

  it("should handle very long function signatures", () => {
    const longSig = `bool ProcessComplexData(const std::vector<uint32>& ids, std::map<uint32, std::string>& output, uint32 flags, float threshold);`;
    const analysis = analyzeCppSource(longSig, "long.h");
    expect(analysis.freeFunctions.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle source with only defines", () => {
    const analysis = analyzeCppSource(DEFINE_SOURCE, "defines.h");
    expect(analysis.testableItems).toBe(0);
    expect(analysis.defines.length).toBeGreaterThanOrEqual(2);
  });

  it("should handle nested braces in class body", () => {
    const nestedSource = `class Foo {
public:
    void Bar() { if (true) { int x = 0; } }
};`;
    const analysis = analyzeCppSource(nestedSource, "nested.h");
    const cls = analysis.classes.find(c => c.name === "Foo");
    expect(cls).toBeDefined();
  });

  it("should handle multiple inheritance", () => {
    const multiInherit = `class Derived : public Base1, public Base2 {
public:
    void Method();
};`;
    const analysis = analyzeCppSource(multiInherit, "multi.h");
    const cls = analysis.classes.find(c => c.name === "Derived");
    expect(cls).toBeDefined();
    expect(cls!.baseClasses.length).toBe(2);
  });

  it("should produce valid output for minimal input", () => {
    const result = generateCppTests("int x();", "minimal.h");
    expect(result.fullContent).toBeTruthy();
    expect(result.stats.totalTests).toBeGreaterThanOrEqual(0);
  });

  it("should handle struct like class", () => {
    const structSrc = `struct Point {
    float x;
    float y;
    float Distance(const Point& other) const;
};`;
    const analysis = analyzeCppSource(structSrc, "point.h");
    const cls = analysis.classes.find(c => c.name === "Point");
    expect(cls).toBeDefined();
  });
});

// ============================================================================
// Test Priority Assignment Tests
// ============================================================================

describe("test priority assignment", () => {
  it("should assign critical priority to null checks", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const result = generateTestCases(analysis);
    const nullTests = result.testCases.filter(tc => tc.testType === "null_check");
    for (const tc of nullTests) {
      expect(tc.priority).toBe("critical");
    }
  });

  it("should assign high priority to basic call tests", () => {
    const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
    const result = generateTestCases(analysis);
    const basicTests = result.testCases.filter(tc => tc.testName.includes("BasicCall"));
    for (const tc of basicTests) {
      expect(tc.priority).toBe("high");
    }
  });

  it("should assign critical priority to constructor tests", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const result = generateTestCases(analysis);
    const ctorTests = result.testCases.filter(tc => tc.testName.includes("Constructor"));
    for (const tc of ctorTests) {
      expect(tc.priority).toBe("critical");
    }
  });
});

// ============================================================================
// Test Code Content Verification
// ============================================================================

describe("test code content", () => {
  it("should include Arrange/Act/Assert comments for method tests", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const result = generateTestCases(analysis);
    const methodTest = result.testCases.find(
      tc => tc.testName.includes("BasicCall") && tc.targetFunction.includes("::")
    );
    expect(methodTest).toBeDefined();
    expect(methodTest!.code).toContain("Arrange");
  });

  it("should create object instance for method tests", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const result = generateTestCases(analysis);
    // Find a non-constructor method test (not the constructor BasicCall)
    const methodTest = result.testCases.find(
      tc => tc.testName.includes("BasicCall") && tc.targetFunction.includes("SpellManager::") && !tc.targetFunction.endsWith("::SpellManager")
    );
    expect(methodTest).toBeDefined();
    expect(methodTest!.code).toContain("SpellManager obj");
  });

  it("should use nullptr in null check tests", () => {
    const analysis = analyzeCppSource(CLASS_SOURCE, "spell.h");
    const result = generateTestCases(analysis);
    const nullTest = result.testCases.find(tc => tc.testType === "null_check");
    expect(nullTest).toBeDefined();
    expect(nullTest!.code).toContain("nullptr");
  });

  it("should use boundary values in boundary tests", () => {
    const analysis = analyzeCppSource(SIMPLE_FUNCTION_SOURCE, "funcs.h");
    const result = generateTestCases(analysis);
    const zeroTest = result.testCases.find(tc => tc.testName.includes("Zero"));
    if (zeroTest) {
      expect(zeroTest.code).toContain("0");
    }
  });

  it("should use const object in const correctness tests", () => {
    const analysis = analyzeCppSource(STATIC_VIRTUAL_SOURCE, "singleton.h");
    const result = generateTestCases(analysis);
    const constTest = result.testCases.find(tc => tc.testName.includes("ConstCorrectness"));
    if (constTest) {
      expect(constTest.code).toContain("const Singleton obj");
    }
  });
});
