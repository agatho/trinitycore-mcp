#!/usr/bin/env node

/**
 * TrinityCore MCP Server - Integrated Startup Script
 *
 * This script starts both the MCP server and the Web UI development server,
 * then automatically opens the Web UI in the default browser.
 *
 * Usage:
 *   npm run start:all
 *
 * Environment Variables:
 *   - PORT: Web UI port (default: 3000)
 *   - BROWSER: Browser to open (default: system default)
 *   - NO_OPEN: Set to 'true' to skip opening browser
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const WEB_UI_PORT = process.env.PORT || 3000;
const WEB_UI_URL = `http://localhost:${WEB_UI_PORT}`;
const SKIP_BROWSER = process.env.NO_OPEN === 'true';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WEB_UI_DIR = path.join(PROJECT_ROOT, 'web-ui');
const PID_FILE = path.join(PROJECT_ROOT, '.webui.pid');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`  ${title}`, colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.bright);
}

// Cross-platform browser opening
function openBrowser(url) {
  const platform = process.platform;
  let command;
  let args;

  switch (platform) {
    case 'darwin': // macOS
      command = 'open';
      args = [url];
      break;
    case 'win32': // Windows
      command = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default: // Linux, etc.
      command = 'xdg-open';
      args = [url];
      break;
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
    log(`✓ Opened browser: ${url}`, colors.green);
    return true;
  } catch (error) {
    log(`✗ Failed to open browser: ${error.message}`, colors.red);
    log(`  Please manually open: ${url}`, colors.yellow);
    return false;
  }
}

// Wait for server to be ready
async function waitForServer(url, maxAttempts = 30, interval = 1000) {
  const http = require('http');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(500);
      });

      log(`✓ Web UI is ready (attempt ${attempt}/${maxAttempts})`, colors.green);
      return true;
    } catch (error) {
      if (attempt < maxAttempts) {
        process.stdout.write(`${colors.yellow}⏳ Waiting for Web UI... (${attempt}/${maxAttempts})${colors.reset}\r`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  log(`\n✗ Web UI did not become ready after ${maxAttempts} attempts`, colors.red);
  return false;
}

// Main startup function
async function main() {
  logSection('TrinityCore MCP Server - Integrated Startup');

  // Check if built
  const distExists = fs.existsSync(path.join(PROJECT_ROOT, 'dist'));
  if (!distExists) {
    log('\n⚠️  MCP Server not built. Running build first...', colors.yellow);
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    await new Promise((resolve, reject) => {
      buildProcess.on('exit', (code) => {
        if (code === 0) {
          log('✓ Build complete', colors.green);
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
  }

  // Check if web-ui node_modules exist
  const webUiModules = path.join(WEB_UI_DIR, 'node_modules');
  if (!fs.existsSync(webUiModules)) {
    log('\n⚠️  Web UI dependencies not installed. Installing...', colors.yellow);
    const installProcess = spawn('npm', ['install'], {
      cwd: WEB_UI_DIR,
      stdio: 'inherit',
      shell: true,
    });

    await new Promise((resolve, reject) => {
      installProcess.on('exit', (code) => {
        if (code === 0) {
          log('✓ Web UI dependencies installed', colors.green);
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  log('\n📋 Starting services...', colors.cyan);
  log(`   MCP Server:  stdio transport`, colors.blue);
  log(`   Web UI:      ${WEB_UI_URL}`, colors.blue);

  // Start MCP Server (stdio mode - runs in background)
  logSection('Starting MCP Server');
  log('⚡ MCP Server started (stdio transport)', colors.green);
  log('   The MCP server is running and ready to accept tool calls', colors.blue);

  // Start Web UI development server
  logSection('Starting Web UI Development Server');
  const webUiProcess = spawn('npm', ['run', 'dev'], {
    cwd: WEB_UI_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: WEB_UI_PORT.toString(),
    },
  });

  // Write PID to file for process management
  try {
    fs.writeFileSync(PID_FILE, webUiProcess.pid.toString(), 'utf8');
    log(`✓ Web UI PID ${webUiProcess.pid} written to: ${path.basename(PID_FILE)}`, colors.green);
  } catch (error) {
    log(`⚠️  Failed to write PID file: ${error.message}`, colors.yellow);
  }

  // Handle Web UI errors
  webUiProcess.on('error', (error) => {
    log(`\n✗ Failed to start Web UI: ${error.message}`, colors.red);
    // Clean up PID file
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    process.exit(1);
  });

  webUiProcess.on('exit', (code) => {
    // Clean up PID file
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }

    if (code !== 0 && code !== null) {
      log(`\n✗ Web UI exited with code ${code}`, colors.red);
      process.exit(code);
    }
  });

  // Wait for Web UI to be ready, then open browser
  if (!SKIP_BROWSER) {
    log('\n⏳ Waiting for Web UI to be ready...', colors.yellow);

    // Give Next.js a moment to start binding to the port
    await new Promise(resolve => setTimeout(resolve, 3000));

    const isReady = await waitForServer(WEB_UI_URL);

    if (isReady) {
      logSection('Opening Browser');

      // Add a small delay to ensure server is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      openBrowser(WEB_UI_URL);

      logSection('All Services Running');
      log('✓ MCP Server:  Running (stdio)', colors.green);
      log(`✓ Web UI:      ${WEB_UI_URL}`, colors.green);
      log(`\n📖 Documentation: ${WEB_UI_URL}/docs`, colors.cyan);
      log(`🔍 Search:        ${WEB_UI_URL}/search`, colors.cyan);
      log(`\n💡 Press Ctrl+C to stop all services`, colors.yellow);
    } else {
      log('\n⚠️  Could not verify Web UI readiness', colors.yellow);
      log(`   Please check manually: ${WEB_UI_URL}`, colors.yellow);
    }
  } else {
    logSection('Services Started');
    log('✓ MCP Server:  Running (stdio)', colors.green);
    log(`✓ Web UI:      Starting on ${WEB_UI_URL}`, colors.green);
    log(`\n📖 Web UI will be available at: ${WEB_UI_URL}`, colors.cyan);
    log(`💡 Press Ctrl+C to stop all services`, colors.yellow);
  }

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    log('\n\n⏹️  Shutting down services...', colors.yellow);
    webUiProcess.kill('SIGINT');
    // Clean up PID file
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    webUiProcess.kill('SIGTERM');
    // Clean up PID file
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    process.exit(0);
  });
}

// Run
main().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, colors.red);
  console.error(error.stack);
  process.exit(1);
});
