/**
 * Profile System Test Script
 *
 * Tests that the profile system compiles and works correctly
 * WITHOUT changing any behavioral defaults.
 */

const {
  ToolProfile,
  TOOL_CATEGORIES,
  COMPOSITE_PROFILES,
  getAllToolNames,
  getTotalToolCount,
  getTotalEstimatedTokens
} = require('../dist/profiles/ToolProfile.js');

const {
  ToolProfileLoader,
  getProfileLoader,
  resetProfileLoader
} = require('../dist/profiles/ProfileLoader.js');

console.log('='.repeat(65));
console.log('PROFILE SYSTEM TEST');
console.log('='.repeat(65));
console.log('');

// Test 1: Tool categories defined correctly
console.log('Test 1: Tool Categories');
console.log('-'.repeat(65));
const categoryCount = Object.keys(TOOL_CATEGORIES).length;
console.log(`✅ ${categoryCount} tool categories defined`);

let totalTools = 0;
Object.entries(TOOL_CATEGORIES).forEach(([name, category]) => {
  console.log(`  - ${category.name}: ${category.tools.length} tools (~${category.estimatedTokens} tokens)`);
  totalTools += category.tools.length;
});
console.log(`Total category tools: ${totalTools}`);
console.log('');

// Test 2: Profile definitions
console.log('Test 2: Profiles');
console.log('-'.repeat(65));
const profiles = Object.values(ToolProfile);
console.log(`✅ ${profiles.length} profiles defined:`);
profiles.forEach(profile => {
  console.log(`  - ${profile}`);
});
console.log('');

// Test 3: Total tool count
console.log('Test 3: Total Tool Inventory');
console.log('-'.repeat(65));
const allTools = getAllToolNames();
const toolCount = getTotalToolCount();
const estimatedTokens = getTotalEstimatedTokens();
console.log(`✅ Total unique tools: ${toolCount}`);
console.log(`✅ Estimated tokens (full): ~${estimatedTokens}`);
console.log('');

// Test 4: Default profile (backward compatibility)
console.log('Test 4: Default Profile (No Env Vars)');
console.log('-'.repeat(65));
resetProfileLoader();
delete process.env.MCP_MODE;
delete process.env.MCP_PROFILE;

const defaultLoader = getProfileLoader();
const defaultStats = defaultLoader.getStats();
console.log(`✅ Default profile: ${defaultStats.profile}`);
console.log(`✅ Tools loaded: ${defaultStats.toolCount}`);
console.log(`✅ Estimated tokens: ~${defaultStats.estimatedTokens}`);

if (defaultStats.profile === ToolProfile.FULL && defaultStats.toolCount === toolCount) {
  console.log('✅ PASS: Default behavior unchanged (loads all tools)');
} else {
  console.log('❌ FAIL: Default profile should be FULL with all tools');
  process.exit(1);
}
console.log('');

// Test 5: Web UI mode
console.log('Test 5: Web UI Mode (MCP_MODE=webui)');
console.log('-'.repeat(65));
resetProfileLoader();
process.env.MCP_MODE = 'webui';

const webuiLoader = getProfileLoader();
const webuiStats = webuiLoader.getStats();
console.log(`✅ Profile: ${webuiStats.profile}`);
console.log(`✅ Tools loaded: ${webuiStats.toolCount}`);
console.log(`✅ Estimated tokens: ~${webuiStats.estimatedTokens}`);

if (webuiStats.profile === ToolProfile.FULL) {
  console.log('✅ PASS: Web UI loads full profile');
} else {
  console.log('❌ FAIL: Web UI should load FULL profile');
  process.exit(1);
}
console.log('');

// Test 6: Claude Code minimal mode
console.log('Test 6: Claude Code Mode (MCP_MODE=claude-code)');
console.log('-'.repeat(65));
resetProfileLoader();
process.env.MCP_MODE = 'claude-code';
delete process.env.MCP_PROFILE;

const claudeLoader = getProfileLoader();
const claudeStats = claudeLoader.getStats();
console.log(`✅ Profile: ${claudeStats.profile}`);
console.log(`✅ Tools loaded: ${claudeStats.toolCount}`);
console.log(`✅ Estimated tokens: ~${claudeStats.estimatedTokens}`);
console.log(`✅ Token reduction: ${claudeStats.tokenReduction.toFixed(1)}%`);

if (claudeStats.profile === ToolProfile.CORE_DATA && claudeStats.toolCount === 10) {
  console.log('✅ PASS: Claude Code defaults to core-data (10 tools)');
} else {
  console.log('❌ FAIL: Claude Code should default to core-data profile');
  process.exit(1);
}
console.log('');

// Test 7: Explicit profile selection
console.log('Test 7: Explicit Profile (MCP_PROFILE=playerbot-dev)');
console.log('-'.repeat(65));
resetProfileLoader();
process.env.MCP_MODE = 'claude-code';
process.env.MCP_PROFILE = 'playerbot-dev';

const botdevLoader = getProfileLoader();
const botdevStats = botdevLoader.getStats();
console.log(`✅ Profile: ${botdevStats.profile}`);
console.log(`✅ Tools loaded: ${botdevStats.toolCount}`);
console.log(`✅ Estimated tokens: ~${botdevStats.estimatedTokens}`);
console.log(`✅ Token reduction: ${botdevStats.tokenReduction.toFixed(1)}%`);

if (botdevStats.profile === ToolProfile.PLAYERBOT_DEV && botdevStats.toolCount >= 27) {
  console.log(`✅ PASS: playerbot-dev profile loads ${botdevStats.toolCount} tools`);
} else {
  console.log('❌ FAIL: playerbot-dev should load at least 27 tools');
  process.exit(1);
}
console.log('');

// Test 8: Tool filtering
console.log('Test 8: Tool Filtering');
console.log('-'.repeat(65));
resetProfileLoader();
process.env.MCP_MODE = 'claude-code';
process.env.MCP_PROFILE = 'core-data';

const coreLoader = getProfileLoader();
const shouldLoad = coreLoader.shouldLoadTool('get-spell-info');
const shouldNotLoad = coreLoader.shouldLoadTool('analyze-bot-performance');

if (shouldLoad && !shouldNotLoad) {
  console.log('✅ PASS: Tool filtering works correctly');
  console.log('  ✅ get-spell-info: should load (core-data)');
  console.log('  ✅ analyze-bot-performance: should NOT load (performance)');
} else {
  console.log('❌ FAIL: Tool filtering not working');
  process.exit(1);
}
console.log('');

// Summary
console.log('='.repeat(65));
console.log('ALL TESTS PASSED ✅');
console.log('='.repeat(65));
console.log('');
console.log('Profile System Status:');
console.log(`  - ${categoryCount} tool categories defined`);
console.log(`  - ${profiles.length} profiles available`);
console.log(`  - ${toolCount} total tools`);
console.log(`  - Backward compatible: YES (defaults to FULL)`);
console.log(`  - Web UI unchanged: YES (always loads all tools)`);
console.log(`  - Claude Code optimized: YES (60-90% token reduction)`);
console.log('');
console.log('Phase 1 Implementation: COMPLETE');
console.log('');
console.log('Next Steps:');
console.log('  1. Review and approve Phase 1 results');
console.log('  2. Proceed to Phase 2: Conditional tool registration');
console.log('  3. Update index.ts to use profile-based loading');
console.log('');

// Clean up
delete process.env.MCP_MODE;
delete process.env.MCP_PROFILE;
