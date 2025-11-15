/**
 * Auto-Detection Integration Test
 *
 * Tests that the MCP server correctly auto-detects client type and selects appropriate profile.
 * Validates the ProfileLoader integration with AutoProfileDetector.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(65));
console.log('AUTO-DETECTION INTEGRATION TEST');
console.log('MCP Server Automatic Profile Selection');
console.log('='.repeat(65));
console.log('');

/**
 * Test MCP server with specific environment
 */
async function testAutoDetection(testName, env, expectedProfile, expectedClientType) {
  return new Promise((resolve, reject) => {
    console.log(`Test: ${testName}`);
    console.log(`  Environment: ${JSON.stringify(env)}`);
    console.log(`  Expected Profile: ${expectedProfile}`);
    console.log(`  Expected Client Type: ${expectedClientType || 'Not specified'}`);

    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

    const server = spawn('node', [serverPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let profileDetected = null;
    let clientTypeDetected = null;
    let autoDetectionUsed = false;

    server.stdout.on('data', (data) => {
      output += data.toString();
      const lines = data.toString().split('\n');

      lines.forEach(line => {
        // Detect profile selection
        if (line.includes('Profile:')) {
          const match = line.match(/Profile:\s+(\S+)/);
          if (match) {
            profileDetected = match[1];
            console.log(`  Detected profile: ${profileDetected}`);
          }
        }

        // Detect auto-detection
        if (line.includes('Auto-detected:')) {
          autoDetectionUsed = true;
          const match = line.match(/Auto-detected:\s+(\S+)/);
          if (match) {
            clientTypeDetected = match[1];
            console.log(`  Auto-detected client type: ${clientTypeDetected}`);
          }
        }

        // Detect explicit profile
        if (line.includes('Using explicit profile:')) {
          const match = line.match(/Using explicit profile:\s+(\S+)/);
          if (match) {
            console.log(`  Using explicit profile: ${match[1]}`);
          }
        }

        // Detect mode-based selection
        if (line.includes('Using full profile for Web UI mode')) {
          console.log(`  Mode-based selection: Web UI → full`);
        }

        if (line.includes('Using core-data profile for Claude Code mode')) {
          console.log(`  Mode-based selection: Claude Code → core-data`);
        }
      });
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      // Validate results
      if (!profileDetected) {
        reject(new Error('Profile not detected in output'));
        return;
      }

      if (profileDetected !== expectedProfile) {
        reject(new Error(`Profile mismatch: expected ${expectedProfile}, got ${profileDetected}`));
        return;
      }

      if (expectedClientType && !autoDetectionUsed) {
        reject(new Error('Expected auto-detection to be used but it was not'));
        return;
      }

      if (expectedClientType && clientTypeDetected !== expectedClientType) {
        reject(new Error(`Client type mismatch: expected ${expectedClientType}, got ${clientTypeDetected}`));
        return;
      }

      console.log(`  ✅ PASS: Profile ${profileDetected} selected correctly`);
      resolve({ testName, profile: profileDetected, clientType: clientTypeDetected });
    });

    // Kill server after 2 seconds
    setTimeout(() => {
      server.kill('SIGTERM');
    }, 2000);
  });
}

/**
 * Run all auto-detection tests
 */
async function runTests() {
  const tests = [
    {
      name: 'Explicit Profile Override (MCP_PROFILE=full)',
      env: { MCP_PROFILE: 'full' },
      expectedProfile: 'full',
      expectedClientType: null // No auto-detection when explicit
    },
    {
      name: 'Explicit Web UI Mode (MCP_MODE=webui)',
      env: { MCP_MODE: 'webui' },
      expectedProfile: 'full',
      expectedClientType: null // No auto-detection when explicit
    },
    {
      name: 'Explicit Claude Code Mode (MCP_MODE=claude-code)',
      env: { MCP_MODE: 'claude-code' },
      expectedProfile: 'core-data',
      expectedClientType: null // No auto-detection when explicit
    },
    {
      name: 'Auto-Detect Unknown Client (No env vars)',
      env: {},
      expectedProfile: 'full', // Safe default for unknown
      expectedClientType: 'unknown'
    },
    {
      name: 'Auto-Detect Claude Code (CLAUDE_CODE_VERSION)',
      env: { CLAUDE_CODE_VERSION: '1.0.0' },
      expectedProfile: 'dynamic', // DYNAMIC profile for Claude Code
      expectedClientType: 'claude-code'
    },
    {
      name: 'Auto-Detect Claude Code (VSCODE_PID)',
      env: { VSCODE_PID: '12345' },
      expectedProfile: 'dynamic', // DYNAMIC profile for Claude Code
      expectedClientType: 'claude-code'
    },
    {
      name: 'Auto-Detect MCP Inspector',
      env: { MCP_INSPECTOR: 'true' },
      expectedProfile: 'full', // Full profile for inspector
      expectedClientType: 'inspector'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await testAutoDetection(test.name, test.env, test.expectedProfile, test.expectedClientType);
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
    console.log('Automatic Profile Detection: COMPLETE');
    console.log('');
    console.log('Auto-detection is working correctly:');
    console.log('  • Explicit overrides work (MCP_PROFILE, MCP_MODE)');
    console.log('  • Auto-detection activates when no explicit config');
    console.log('  • Claude Code detected → DYNAMIC profile');
    console.log('  • MCP Inspector detected → FULL profile');
    console.log('  • Unknown clients → FULL profile (safe default)');
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
