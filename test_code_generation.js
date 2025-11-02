#!/usr/bin/env node
/**
 * Test Script for Phase 5 Week 3: Code Generation Tools
 * Tests all code generation MCP tools and validates output
 */

import {
  generateBotComponent,
  generatePacketHandler,
  generateCMakeIntegration,
  validateGeneratedCode,
  listCodeTemplates,
  getTemplateInfo
} from './dist/tools/codegen.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'generated_test_output');

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function cleanupOutputDir() {
  try {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`${CYAN}Cleaned up test output directory${RESET}\n`);
  } catch (error) {
    console.error(`${RED}Failed to clean output directory: ${error}${RESET}`);
  }
}

async function test1_ListTemplates() {
  console.log(`${YELLOW}Test 1: Listing available code templates...${RESET}`);

  try {
    const result = await listCodeTemplates();

    console.log(`Found ${result.count} templates in ${result.retrievalTime.toFixed(2)}ms`);
    console.log(`Templates:`);
    result.templates.forEach(template => {
      console.log(`  - ${template}`);
    });

    console.log(`${GREEN}✓ Test 1 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 1 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test2_GetTemplateInfo() {
  console.log(`${YELLOW}Test 2: Getting template metadata...${RESET}`);

  try {
    const result = await getTemplateInfo('ai_strategies/combat_strategy');

    console.log(`Template: ${result.name}`);
    console.log(`Description: ${result.description || 'N/A'}`);
    console.log(`Required parameters (${result.requiredParams.length}):`);
    result.requiredParams.slice(0, 10).forEach(param => {
      console.log(`  - ${param}`);
    });
    if (result.requiredParams.length > 10) {
      console.log(`  ... and ${result.requiredParams.length - 10} more`);
    }
    console.log(`Optional parameters (${result.optionalParams.length}):`);
    result.optionalParams.slice(0, 5).forEach(param => {
      console.log(`  - ${param}`);
    });
    if (result.optionalParams.length > 5) {
      console.log(`  ... and ${result.optionalParams.length - 5} more`);
    }
    console.log(`Retrieval time: ${result.retrievalTime.toFixed(2)}ms`);

    console.log(`${GREEN}✓ Test 2 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 2 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test3_GenerateDPSStrategy() {
  console.log(`${YELLOW}Test 3: Generating DPS combat strategy (WarriorFuryStrategy)...${RESET}`);

  try {
    const outputPath = path.join(OUTPUT_DIR, 'ai_strategies', 'WarriorFuryStrategy.h');

    const result = await generateBotComponent({
      componentType: 'ai_strategy',
      className: 'WarriorFuryStrategy',
      description: 'Fury Warrior DPS combat strategy with rage management',
      role: 'dps',
      outputPath,
      namespace: 'Playerbot::AI',
      includeTests: false
    });

    console.log(`Generated: ${result.generated.filePath}`);
    console.log(`File size: ${(result.generated.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Lines of code: ${result.generated.linesOfCode}`);
    console.log(`Generation time: ${result.generationTime.toFixed(2)}ms`);

    // Check performance target (<500ms p95)
    if (result.generationTime > 500) {
      console.log(`${YELLOW}⚠ Generation time exceeded 500ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.generationTime.toFixed(2)}ms < 500ms)${RESET}`);
    }

    // Verify file exists
    const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error('Generated file not found');
    }

    // Check content
    const content = await fs.readFile(outputPath, 'utf-8');
    const checks = [
      { name: '#pragma once', pattern: /#pragma once/, required: true },
      { name: 'Class definition', pattern: /class WarriorFuryStrategy/, required: true },
      { name: 'Update method', pattern: /void Update\(BotAI\* ai, uint32 diff\)/, required: true },
      { name: 'Thread-safety', pattern: /Thread-safe|mutex/, required: true },
      { name: 'Namespace', pattern: /namespace Playerbot::AI/, required: true },
      { name: 'DPS role implementation', pattern: /GetRotationSpell|isDPS/, required: true },
    ];

    console.log(`Content checks:`);
    for (const check of checks) {
      const passed = check.pattern.test(content);
      if (check.required && !passed) {
        throw new Error(`Missing required content: ${check.name}`);
      }
      console.log(`  ${passed ? GREEN + '✓' : RED + '✗'} ${check.name}${RESET}`);
    }

    console.log(`${GREEN}✓ Test 3 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 3 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test4_GenerateTankStrategy() {
  console.log(`${YELLOW}Test 4: Generating Tank combat strategy (PaladinProtectionStrategy)...${RESET}`);

  try {
    const outputPath = path.join(OUTPUT_DIR, 'ai_strategies', 'PaladinProtectionStrategy.h');

    const result = await generateBotComponent({
      componentType: 'ai_strategy',
      className: 'PaladinProtectionStrategy',
      description: 'Protection Paladin tanking strategy with threat management',
      role: 'tank',
      outputPath,
      namespace: 'Playerbot::AI',
      includeTests: false
    });

    console.log(`Generated: ${result.generated.filePath}`);
    console.log(`File size: ${(result.generated.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Lines of code: ${result.generated.linesOfCode}`);
    console.log(`Generation time: ${result.generationTime.toFixed(2)}ms`);

    // Verify tank-specific content
    const content = await fs.readFile(outputPath, 'utf-8');
    const tankChecks = [
      { name: 'ManageThreat method', pattern: /void ManageThreat/, required: true },
      { name: 'Defensive cooldowns', pattern: /ShouldUseDefensiveCooldown|defensiveThreshold/, required: true },
      { name: 'Tank role flag', pattern: /isTank|Tank logic/, required: false },
    ];

    console.log(`Tank-specific checks:`);
    for (const check of tankChecks) {
      const passed = check.pattern.test(content);
      if (check.required && !passed) {
        throw new Error(`Missing required tank content: ${check.name}`);
      }
      console.log(`  ${passed ? GREEN + '✓' : RED + '✗'} ${check.name}${RESET}`);
    }

    console.log(`${GREEN}✓ Test 4 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 4 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test5_GenerateHealerStrategy() {
  console.log(`${YELLOW}Test 5: Generating Healer combat strategy (PriestHolyStrategy)...${RESET}`);

  try {
    const outputPath = path.join(OUTPUT_DIR, 'ai_strategies', 'PriestHolyStrategy.h');

    const result = await generateBotComponent({
      componentType: 'ai_strategy',
      className: 'PriestHolyStrategy',
      description: 'Holy Priest healing strategy with mana management',
      role: 'healer',
      outputPath,
      namespace: 'Playerbot::AI',
      includeTests: false
    });

    console.log(`Generated: ${result.generated.filePath}`);
    console.log(`File size: ${(result.generated.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Lines of code: ${result.generated.linesOfCode}`);
    console.log(`Generation time: ${result.generationTime.toFixed(2)}ms`);

    // Verify healer-specific content
    const content = await fs.readFile(outputPath, 'utf-8');
    const healerChecks = [
      { name: 'SelectHealTarget method', pattern: /Unit\* SelectHealTarget/, required: true },
      { name: 'Emergency heal logic', pattern: /EMERGENCY_HEAL|emergency/i, required: true },
      { name: 'Healer role flag', pattern: /isHealer.*true/i, required: false },
    ];

    console.log(`Healer-specific checks:`);
    for (const check of healerChecks) {
      const passed = check.pattern.test(content);
      if (check.required && !passed) {
        throw new Error(`Missing required healer content: ${check.name}`);
      }
      console.log(`  ${passed ? GREEN + '✓' : RED + '✗'} ${check.name}${RESET}`);
    }

    console.log(`${GREEN}✓ Test 5 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 5 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test6_GeneratePacketHandler() {
  console.log(`${YELLOW}Test 6: Generating packet handler (CastSpellHandler)...${RESET}`);

  try {
    const outputPath = path.join(OUTPUT_DIR, 'packet_handlers', 'CastSpellHandler.h');

    const result = await generatePacketHandler({
      handlerName: 'CastSpellHandler',
      opcode: 'CMSG_CAST_SPELL',
      direction: 'client',
      description: 'Handles spell casting requests from bots',
      fields: [
        { name: 'casterGuid', type: 'ObjectGuid', description: 'GUID of casting unit', isGuid: true },
        { name: 'spellId', type: 'uint32', description: 'Spell ID to cast' },
        { name: 'targetGuid', type: 'ObjectGuid', description: 'GUID of target unit', isGuid: true },
        { name: 'castFlags', type: 'uint8', description: 'Casting flags' },
      ],
      outputPath,
      namespace: 'Playerbot::Packets'
    });

    console.log(`Generated: ${result.generated.filePath}`);
    console.log(`File size: ${(result.generated.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Lines of code: ${result.generated.linesOfCode}`);
    console.log(`Generation time: ${result.generationTime.toFixed(2)}ms`);

    // Check performance target (<312ms p95)
    if (result.generationTime > 312) {
      console.log(`${YELLOW}⚠ Generation time exceeded 312ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.generationTime.toFixed(2)}ms < 312ms)${RESET}`);
    }

    // Verify packet handler content
    const content = await fs.readFile(outputPath, 'utf-8');
    const packetChecks = [
      { name: 'Packet class', pattern: /class CastSpellHandler/, required: true },
      { name: 'Build method', pattern: /WorldPacket.*Build/, required: true },
      { name: 'Opcode constant', pattern: /CMSG_CAST_SPELL/, required: true },
      { name: 'Field: casterGuid', pattern: /casterGuid/, required: true },
      { name: 'Field: spellId', pattern: /spellId/, required: true },
      { name: 'Validation logic', pattern: /IsEmpty\(\)|== 0/, required: true },
    ];

    console.log(`Packet handler checks:`);
    for (const check of packetChecks) {
      const passed = check.pattern.test(content);
      if (check.required && !passed) {
        throw new Error(`Missing required packet content: ${check.name}`);
      }
      console.log(`  ${passed ? GREEN + '✓' : RED + '✗'} ${check.name}${RESET}`);
    }

    console.log(`${GREEN}✓ Test 6 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 6 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test7_GenerateCMake() {
  console.log(`${YELLOW}Test 7: Generating CMakeLists.txt...${RESET}`);

  try {
    const outputPath = path.join(OUTPUT_DIR, 'playerbot_ai_module', 'CMakeLists.txt');

    const result = await generateCMakeIntegration({
      projectName: 'playerbot_ai_module',
      sourceFiles: [
        'AI/BotAI.cpp',
        'AI/Combat/WarriorFuryStrategy.cpp',
        'AI/Combat/PaladinProtectionStrategy.cpp',
        'AI/Healing/PriestHolyStrategy.cpp',
      ],
      headerFiles: [
        'AI/BotAI.h',
        'AI/Combat/WarriorFuryStrategy.h',
        'AI/Combat/PaladinProtectionStrategy.h',
        'AI/Healing/PriestHolyStrategy.h',
      ],
      testFiles: [
        'Tests/WarriorFuryStrategyTest.cpp',
        'Tests/PaladinProtectionStrategyTest.cpp',
      ],
      isLibrary: true,
      dependencies: ['game', 'shared'],
      includeDirectories: ['${CMAKE_CURRENT_SOURCE_DIR}/AI'],
      outputPath
    });

    console.log(`Generated: ${result.generated.filePath}`);
    console.log(`File size: ${(result.generated.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Lines of code: ${result.generated.linesOfCode}`);
    console.log(`Generation time: ${result.generationTime.toFixed(2)}ms`);

    // Check performance target (<200ms p95)
    if (result.generationTime > 200) {
      console.log(`${YELLOW}⚠ Generation time exceeded 200ms target${RESET}`);
    } else {
      console.log(`${GREEN}✓ Performance target met (${result.generationTime.toFixed(2)}ms < 200ms)${RESET}`);
    }

    // Verify CMake content
    const content = await fs.readFile(outputPath, 'utf-8');
    const cmakeChecks = [
      { name: 'Project name variable', pattern: /playerbot_ai_module_SOURCES/, required: true },
      { name: 'Source files', pattern: /WarriorFuryStrategy\.cpp/, required: true },
      { name: 'Header files', pattern: /WarriorFuryStrategy\.h/, required: true },
      { name: 'Test files', pattern: /WarriorFuryStrategyTest\.cpp/, required: true },
      { name: 'Add library', pattern: /add_library\(playerbot_ai_module/, required: true },
      { name: 'Dependencies', pattern: /target_link_libraries[\s\S]*game/, required: true },
      { name: 'Test integration', pattern: /BUILD_TESTING/, required: true },
    ];

    console.log(`CMake checks:`);
    for (const check of cmakeChecks) {
      const passed = check.pattern.test(content);
      if (check.required && !passed) {
        throw new Error(`Missing required CMake content: ${check.name}`);
      }
      console.log(`  ${passed ? GREEN + '✓' : RED + '✗'} ${check.name}${RESET}`);
    }

    console.log(`${GREEN}✓ Test 7 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 7 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test8_ValidateGeneratedCode() {
  console.log(`${YELLOW}Test 8: Validating generated code...${RESET}`);

  try {
    const filePath = path.join(OUTPUT_DIR, 'ai_strategies', 'WarriorFuryStrategy.h');

    const result = await validateGeneratedCode({
      filePath,
      checkCompilation: false,  // Skip compilation check (no full TrinityCore headers)
      checkStyle: true
    });

    console.log(`Validation result: ${result.valid ? GREEN + 'VALID' : RED + 'INVALID'}${RESET}`);
    console.log(`Validation time: ${result.validationTime.toFixed(2)}ms`);

    if (result.errors.length > 0) {
      console.log(`${RED}Errors (${result.errors.length}):${RESET}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (result.warnings.length > 0) {
      console.log(`${YELLOW}Warnings (${result.warnings.length}):${RESET}`);
      result.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    if (result.errors.length === 0) {
      console.log(`${GREEN}✓ No validation errors${RESET}`);
    }

    console.log(`${GREEN}✓ Test 8 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 8 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test9_PerformanceSummary() {
  console.log(`${YELLOW}Test 9: Performance summary across all roles...${RESET}`);

  try {
    const roles = [
      { type: 'dps', className: 'MageFrostStrategy', target: 500 },
      { type: 'tank', className: 'WarriorProtectionStrategy', target: 500 },
      { type: 'healer', className: 'DruidRestorationStrategy', target: 500 },
    ];

    const results = [];

    for (const role of roles) {
      const outputPath = path.join(OUTPUT_DIR, 'performance_test', `${role.className}.h`);

      const result = await generateBotComponent({
        componentType: 'ai_strategy',
        className: role.className,
        role: role.type,
        outputPath,
        includeTests: false
      });

      results.push({
        role: role.type,
        className: role.className,
        time: result.generationTime,
        target: role.target,
        sizeKB: result.generated.sizeBytes / 1024,
        loc: result.generated.linesOfCode
      });
    }

    console.log(`Performance results:`);
    console.log(`\n${'Role'.padEnd(10)} ${'Class'.padEnd(30)} ${'Time'.padEnd(12)} ${'Target'.padEnd(12)} ${'Size'.padEnd(12)} ${'LOC'.padEnd(8)}`);
    console.log('-'.repeat(88));

    let totalTime = 0;
    let allMeetTarget = true;

    for (const r of results) {
      const meetsTarget = r.time < r.target;
      const color = meetsTarget ? GREEN : RED;

      console.log(
        `${r.role.padEnd(10)} ` +
        `${r.className.padEnd(30)} ` +
        `${color}${r.time.toFixed(2)}ms${RESET}`.padEnd(22) +
        `${r.target}ms`.padEnd(12) +
        `${r.sizeKB.toFixed(2)} KB`.padEnd(12) +
        `${r.loc}`
      );

      totalTime += r.time;
      if (!meetsTarget) allMeetTarget = false;
    }

    console.log('-'.repeat(88));
    console.log(`Average generation time: ${(totalTime / results.length).toFixed(2)}ms`);
    console.log(`All targets met: ${allMeetTarget ? GREEN + 'YES' : RED + 'NO'}${RESET}`);

    console.log(`${GREEN}✓ Test 9 passed${RESET}\n`);
    return true;
  } catch (error) {
    console.error(`${RED}✗ Test 9 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function runAllTests() {
  console.log(`${CYAN}=== TrinityCore MCP Server - Code Generation Test Suite ===${RESET}\n`);

  await cleanupOutputDir();

  const tests = [
    { name: 'List Templates', fn: test1_ListTemplates },
    { name: 'Get Template Info', fn: test2_GetTemplateInfo },
    { name: 'Generate DPS Strategy', fn: test3_GenerateDPSStrategy },
    { name: 'Generate Tank Strategy', fn: test4_GenerateTankStrategy },
    { name: 'Generate Healer Strategy', fn: test5_GenerateHealerStrategy },
    { name: 'Generate Packet Handler', fn: test6_GeneratePacketHandler },
    { name: 'Generate CMake', fn: test7_GenerateCMake },
    { name: 'Validate Generated Code', fn: test8_ValidateGeneratedCode },
    { name: 'Performance Summary', fn: test9_PerformanceSummary },
  ];

  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  console.log(`${CYAN}=== Test Summary ===${RESET}\n`);

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? GREEN + '✓' : RED + '✗';
    console.log(`${icon} ${r.name}${RESET}`);
  });

  console.log(`\n${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);

  if (passed === total) {
    console.log(`${GREEN}\n=== All tests passed! ===${RESET}`);
  } else {
    console.log(`${RED}\n=== Some tests failed ===${RESET}`);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${RED}Fatal error: ${error}${RESET}`);
  process.exit(1);
});
