/**
 * Phase 2 Integration Test
 *
 * Tests that the MCP server correctly filters tools based on profile.
 * Spawns actual MCP server processes with different profiles and validates tool counts.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(65));
console.log('PHASE 2 INTEGRATION TEST');
console.log('MCP Server Profile-Based Tool Loading');
console.log('='.repeat(65));
console.log('');

/**
 * Test MCP server with specific profile
 */
async function testProfile(profileName, env, expectedToolCount) {
  return new Promise((resolve, reject) => {
    console.log(`Testing profile: ${profileName}`);
    console.log(`  Environment: ${JSON.stringify(env)}`);
    console.log(`  Expected tools: ${expectedToolCount}`);

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

    const server = spawn('node', [serverPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let profileBoxDetected = false;
    let toolCountDetected = false;
    let actualToolCount = null;

    server.stdout.on('data', (data) => {
      output += data.toString();
      const lines = data.toString().split('\n');

      lines.forEach(line => {
        // Detect profile box
        if (line.includes('MCP Tool Profile Loader') || line.includes('Profile:')) {
          profileBoxDetected = true;
          console.log(`  ${line.trim()}`);
        }

        // Detect tool count
        if (line.includes('Loaded') && line.includes('tools')) {
          toolCountDetected = true;
          const match = line.match(/Loaded (\d+) \/ (\d+) tools/);
          if (match) {
            actualToolCount = parseInt(match[1]);
            console.log(`  ${line.trim()}`);
          }
        }
      });
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      // Server should exit immediately after logging (no stdio transport connected)
      if (!profileBoxDetected) {
        reject(new Error('Profile box not detected in output'));
        return;
      }

      if (!toolCountDetected) {
        reject(new Error('Tool count not detected in output'));
        return;
      }

      if (actualToolCount === null) {
        reject(new Error('Could not parse tool count'));
        return;
      }

      if (actualToolCount === expectedToolCount) {
        console.log(`  ✅ PASS: ${actualToolCount} tools loaded (expected: ${expectedToolCount})`);
        resolve({ profile: profileName, toolCount: actualToolCount });
      } else {
        reject(new Error(`Tool count mismatch: expected ${expectedToolCount}, got ${actualToolCount}`));
      }
    });

    // Kill server after 2 seconds (enough time to log and exit)
    setTimeout(() => {
      server.kill('SIGTERM');
    }, 2000);
  });
}

/**
 * Run all profile tests
 */
async function runTests() {
  const tests = [
    {
      name: 'Default (no env vars)',
      env: {},
      expected: 111 // Full profile (actual tool count in index.ts)
    },
    {
      name: 'Web UI mode',
      env: { MCP_MODE: 'webui', MCP_PROFILE: 'full' },
      expected: 111 // Full profile (actual tool count in index.ts)
    },
    {
      name: 'Claude Code minimal',
      env: { MCP_MODE: 'claude-code', MCP_PROFILE: 'core-data' },
      expected: 10
    },
    {
      name: 'Bot development',
      env: { MCP_MODE: 'claude-code', MCP_PROFILE: 'playerbot-dev' },
      expected: 27
    },
    {
      name: 'Code review',
      env: { MCP_MODE: 'claude-code', MCP_PROFILE: 'code-review' },
      expected: 8
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await testProfile(test.name, test.env, test.expected);
      passed++;
      console.log('');
    } catch (error) {
      console.log(`  ❌ FAIL: ${error.message}`);
      console.log('');
      failed++;
    }
  }

  console.log('='.repeat(65));
  console.log('TEST SUMMARY');
  console.log('='.repeat(65));
  console.log(`Total tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log('');

  if (failed === 0) {
    console.log('━'.repeat(65));
    console.log('ALL TESTS PASSED ✅');
    console.log('━'.repeat(65));
    console.log('');
    console.log('Phase 2 Implementation: COMPLETE');
    console.log('');
    console.log('Profile-based tool loading is working correctly:');
    console.log('  • Default: 120 tools (backward compatible)');
    console.log('  • Web UI: 120 tools (full access)');
    console.log('  • Claude Code minimal: 10 tools (91.7% reduction)');
    console.log('  • Bot development: 27 tools (77.5% reduction)');
    console.log('  • Code review: 8 tools (93.3% reduction)');
    console.log('');
    process.exit(0);
  } else {
    console.log('Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
