# TrinityCore MCP Server - Installation Guide

Complete step-by-step installation guide for the TrinityCore Model Context Protocol (MCP) Server.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Configuration](#configuration)
4. [Building the Server](#building-the-server)
5. [Claude Code Integration](#claude-code-integration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Data File Setup](#data-file-setup)

---

## Prerequisites

Before installing the TrinityCore MCP Server, ensure you have:

### Required Software

1. **Node.js** (v18.0.0 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (v9.0.0 or higher)
   - Comes with Node.js
   - Verify installation: `npm --version`

3. **MySQL Server** (v8.0 or higher, v9.4 recommended)
   - Must be running TrinityCore databases
   - Verify installation: `mysql --version`

4. **TrinityCore Server** (installed and configured)
   - World, Auth, and Characters databases populated
   - GameTable (GT) files available
   - Optional: DBC/DB2 files extracted

### System Requirements

- **OS**: Windows 10/11, Linux, or macOS
- **RAM**: 512 MB minimum (2 GB recommended)
- **Disk**: 100 MB for MCP server + data file storage
- **Network**: Access to MySQL server (local or remote)

---

## Installation Steps

### Step 1: Extract or Clone the Repository

If you received this as a ZIP file:
```bash
# Extract to your desired location
# Example: C:\TrinityBots\trinitycore-mcp
```

If cloning from Git:
```bash
git clone <repository-url> trinitycore-mcp
cd trinitycore-mcp
```

### Step 2: Install Dependencies

Navigate to the MCP server directory and install Node.js packages:

```bash
cd trinitycore-mcp
npm install
```

**Expected output:**
```
added 150 packages, and audited 151 packages in 15s
```

### Step 3: Configure Environment Variables

1. **Copy the template file:**
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.template .env

   # Linux/macOS
   cp .env.template .env
   ```

2. **Edit the `.env` file** with your configuration:
   ```bash
   # Windows
   notepad .env

   # Linux/macOS
   nano .env
   # or
   vim .env
   ```

3. **Required configuration** (see [Configuration](#configuration) section below)

### Step 4: Build the TypeScript Server

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

**Expected output:**
```
> @trinitycore/mcp-server@1.0.0 build
> tsc

(No errors = successful build)
```

**Verify build output:**
```bash
# Windows (PowerShell)
dir dist

# Linux/macOS
ls -la dist
```

You should see:
- `index.js` - Main server file
- `tools/` - Directory with all compiled MCP tools
- `database/` - Database connection modules
- Various `.d.ts` and `.js.map` files

---

## Configuration

### Database Settings

Edit the `.env` file with your TrinityCore database credentials:

```env
# MySQL Connection
TRINITY_DB_HOST=localhost        # Your MySQL server address
TRINITY_DB_PORT=3306            # MySQL port (default: 3306)
TRINITY_DB_USER=trinity         # MySQL username
TRINITY_DB_PASSWORD=your_password_here  # MySQL password

# Database Names
TRINITY_DB_WORLD=world          # World database name
TRINITY_DB_AUTH=auth            # Auth database name
TRINITY_DB_CHARACTERS=characters # Characters database name
```

**Security Note:** The database user only needs **SELECT** (read-only) permissions for MCP server operation.

### Data File Paths

Configure paths to your TrinityCore data files:

```env
# TrinityCore Root (optional - for future features)
TRINITY_ROOT=C:\TrinityCore

# GameTable Files (required for combat mechanics, XP calculations)
GT_PATH=C:\TrinityServer\data\gt

# DBC Files (optional - for legacy data)
DBC_PATH=C:\TrinityServer\data\dbc

# DB2 Files (optional - for modern client data)
DB2_PATH=C:\TrinityServer\data\db2
```

**Path Format Notes:**
- **Windows**: Use forward slashes `/` or escaped backslashes `\\`
  - ✅ `C:/TrinityServer/data/gt`
  - ✅ `C:\\TrinityServer\\data\\gt`
  - ❌ `C:\TrinityServer\data\gt` (will cause errors)
- **Linux/macOS**: Use standard paths
  - ✅ `/home/user/TrinityCore/data/gt`
  - ✅ `./data/gt` (relative path)

### Relative vs Absolute Paths

**Development:**
```env
GT_PATH=./data/gt
DBC_PATH=./data/dbc
DB2_PATH=./data/db2
```

**Production:**
```env
GT_PATH=C:/TrinityServer/data/gt
DBC_PATH=C:/TrinityServer/data/dbc
DB2_PATH=C:/TrinityServer/data/db2
```

---

## Building the Server

### Development Build

For development with automatic recompilation:

```bash
npm run dev
```

This will watch for file changes and rebuild automatically.

### Production Build

For production deployment:

```bash
npm run build
```

### Verify Build Success

Check for compilation errors:
```bash
npm run build 2>&1 | findstr /C:"error TS"
```

If no output, build succeeded! ✅

---

## Starting the MCP Server

The TrinityCore MCP Server can be started in two ways:

### Method 1: Standalone (Testing/Development)

Start the server directly for testing:

```bash
# Navigate to the MCP directory
cd C:\TrinityBots\trinitycore-mcp

# Start the server (requires .env file configured)
node dist/index.js
```

**Expected Output:**
```
TrinityCore MCP Server running on stdio
```

**When to use standalone mode:**
- Testing server functionality
- Debugging database connections
- Development and troubleshooting
- Verifying build output

**Note:** Standalone mode uses stdio transport. For interactive testing, pipe commands via stdin/stdout.

### Method 2: Via MCP Client (Production)

The recommended way is to let an MCP-compatible client (Claude Code, Claude Desktop, etc.) start the server automatically. The client will:
1. Execute `node dist/index.js`
2. Establish stdio communication
3. Send JSON-RPC requests
4. Manage the server lifecycle

**This is the normal production usage mode.**

---

## MCP Client Integration

The TrinityCore MCP Server works with any Model Context Protocol (MCP) compatible client. Below are detailed instructions for popular clients.

---

## 🔵 Claude Code Integration (CLI)

**Claude Code** is the command-line interface for Claude AI development. Perfect for bot development and scripting.

### Step 1: Locate Claude Code Configuration Directory

Find your Claude Code configuration directory:

**Windows:**
```powershell
cd %USERPROFILE%\.claude
```

**Linux/macOS:**
```bash
cd ~/.claude
```

**Verify directory exists:**
```bash
# Windows (PowerShell)
Test-Path "$env:USERPROFILE\.claude"

# Linux/macOS
ls -la ~/.claude
```

If directory doesn't exist, create it:
```bash
# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude"

# Linux/macOS
mkdir -p ~/.claude
```

### Step 2: Create MCP Server Configuration File

Create or edit `.claude/mcp-servers-config.json`:

**Windows Example:**
```json
{
  "trinitycore": {
    "command": "node",
    "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_PORT": "3306",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}",
      "TRINITY_DB_WORLD": "world",
      "TRINITY_DB_AUTH": "auth",
      "TRINITY_DB_CHARACTERS": "characters",
      "GT_PATH": "C:\\TrinityServer\\data\\gt",
      "DBC_PATH": "C:\\TrinityServer\\data\\dbc",
      "DB2_PATH": "C:\\TrinityServer\\data\\db2",
      "TRINITY_ROOT": "C:\\TrinityCore"
    }
  }
}
```

**Linux/macOS Example:**
```json
{
  "trinitycore": {
    "command": "node",
    "args": ["/home/user/trinitycore-mcp/dist/index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_PORT": "3306",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}",
      "TRINITY_DB_WORLD": "world",
      "TRINITY_DB_AUTH": "auth",
      "TRINITY_DB_CHARACTERS": "characters",
      "GT_PATH": "/home/user/TrinityServer/data/gt",
      "DBC_PATH": "/home/user/TrinityServer/data/dbc",
      "DB2_PATH": "/home/user/TrinityServer/data/db2",
      "TRINITY_ROOT": "/home/user/TrinityCore"
    }
  }
}
```

**Configuration Notes:**
1. **Server Name**: `"trinitycore"` can be any unique identifier
2. **Command**: Always `"node"` (requires Node.js in PATH)
3. **Args**: **ABSOLUTE PATH** to `dist/index.js`
4. **Path Format**:
   - Windows: Use `\\` (double backslash) in JSON
   - Linux/macOS: Use `/` (forward slash)
5. **Environment Variables**: Use `${VAR_NAME}` for sensitive values

### Step 3: Set Environment Variables (Recommended)

Store sensitive information in system environment variables instead of the config file:

**Windows (PowerShell - User Level):**
```powershell
# Set password (persists across sessions)
[System.Environment]::SetEnvironmentVariable('TRINITY_DB_PASSWORD', 'your_password_here', 'User')

# Verify
$env:TRINITY_DB_PASSWORD
```

**Windows (CMD - System Level, requires Admin):**
```cmd
setx TRINITY_DB_PASSWORD "your_password_here" /M
```

**Linux/macOS (bash):**
```bash
# Add to ~/.bashrc (or ~/.zshrc for zsh)
echo 'export TRINITY_DB_PASSWORD="your_password_here"' >> ~/.bashrc

# Reload
source ~/.bashrc

# Verify
echo $TRINITY_DB_PASSWORD
```

**Alternative: Direct Password in Config** (Less Secure)
```json
{
  "trinitycore": {
    "env": {
      "TRINITY_DB_PASSWORD": "your_actual_password"
    }
  }
}
```

⚠️ **Security Warning**: Direct passwords in config files can be exposed. Use environment variables for production.

### Step 4: Restart Claude Code

After configuration:

```bash
# 1. Close all Claude Code instances
# (Close terminal windows, kill processes if needed)

# 2. Relaunch Claude Code
claude

# 3. Verify MCP server loaded
# Claude Code will show available MCP servers on startup
```

### Step 5: Test Integration

In Claude Code, test the MCP connection:

```
Use the TrinityCore MCP to get spell information for spell ID 133
```

**Expected Response:**
```json
{
  "spellId": 133,
  "name": "Fireball",
  "description": "Hurls a fiery ball...",
  ...
}
```

**List Available Tools:**
```
List all available TrinityCore MCP tools
```

You should see 21 tools listed.

---

## 🟣 Claude Desktop Integration (GUI)

**Claude Desktop** is the graphical desktop application for Claude AI.

### Step 1: Locate Claude Desktop Configuration

Claude Desktop stores configuration in a different location than Claude Code:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Full path example:
```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Edit Configuration File

**Open the configuration file:**

**Windows:**
```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

**macOS:**
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
# or
gedit ~/.config/Claude/claude_desktop_config.json
```

### Step 3: Add MCP Server Configuration

If the file is empty or doesn't exist, create it with this structure:

```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "TRINITY_DB_HOST": "localhost",
        "TRINITY_DB_PORT": "3306",
        "TRINITY_DB_USER": "trinity",
        "TRINITY_DB_PASSWORD": "your_password_here",
        "TRINITY_DB_WORLD": "world",
        "TRINITY_DB_AUTH": "auth",
        "TRINITY_DB_CHARACTERS": "characters",
        "GT_PATH": "C:\\TrinityServer\\data\\gt",
        "DBC_PATH": "C:\\TrinityServer\\data\\dbc",
        "DB2_PATH": "C:\\TrinityServer\\data\\db2"
      }
    }
  }
}
```

**macOS/Linux Example:**
```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["/Users/username/trinitycore-mcp/dist/index.js"],
      "env": {
        "TRINITY_DB_HOST": "localhost",
        "TRINITY_DB_PORT": "3306",
        "TRINITY_DB_USER": "trinity",
        "TRINITY_DB_PASSWORD": "your_password_here",
        "TRINITY_DB_WORLD": "world",
        "TRINITY_DB_AUTH": "auth",
        "TRINITY_DB_CHARACTERS": "characters",
        "GT_PATH": "/Users/username/TrinityServer/data/gt",
        "DBC_PATH": "/Users/username/TrinityServer/data/dbc",
        "DB2_PATH": "/Users/username/TrinityServer/data/db2"
      }
    }
  }
}
```

**Key Differences from Claude Code:**
- Configuration key is `"mcpServers"` (not at root level)
- Password typically stored directly (Claude Desktop doesn't support `${VAR}` syntax)
- File location is application-specific

### Step 4: Restart Claude Desktop

1. **Quit Claude Desktop completely** (File → Quit, not just close window)
2. **Relaunch Claude Desktop**
3. **Verify MCP Server** is loaded (check settings or use a test query)

### Step 5: Test in Claude Desktop

In a new conversation:
```
Use the TrinityCore MCP server to get information about spell ID 133 (Fireball)
```

Check if MCP tools are available:
```
What TrinityCore MCP tools are available?
```

---

## 🔷 GitHub Copilot Integration (Experimental)

**Note:** GitHub Copilot's MCP support is limited and experimental. This integration may not work with all Copilot versions.

### Copilot CLI (copilot-cli)

If using GitHub Copilot CLI with MCP support:

1. **Create MCP configuration file:**

**Location:** `~/.github-copilot/mcp-servers.json`

```json
{
  "servers": {
    "trinitycore": {
      "command": "node",
      "args": ["/absolute/path/to/trinitycore-mcp/dist/index.js"],
      "env": {
        "TRINITY_DB_HOST": "localhost",
        "TRINITY_DB_PORT": "3306",
        "TRINITY_DB_USER": "trinity",
        "TRINITY_DB_PASSWORD": "your_password",
        "TRINITY_DB_WORLD": "world",
        "GT_PATH": "/path/to/data/gt"
      }
    }
  }
}
```

2. **Restart Copilot CLI:**
```bash
gh copilot restart
```

**⚠️ Status:** GitHub Copilot MCP integration is experimental and may not be officially supported. Check GitHub Copilot documentation for latest MCP support status.

---

## 🔶 Generic MCP Client Integration

For any MCP-compatible client that follows the Model Context Protocol specification:

### Configuration Template

Most MCP clients use similar configuration patterns:

```json
{
  "servers": {
    "trinitycore": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/trinitycore-mcp/dist/index.js"],
      "env": {
        "TRINITY_DB_HOST": "localhost",
        "TRINITY_DB_PORT": "3306",
        "TRINITY_DB_USER": "trinity",
        "TRINITY_DB_PASSWORD": "password",
        "TRINITY_DB_WORLD": "world",
        "TRINITY_DB_AUTH": "auth",
        "TRINITY_DB_CHARACTERS": "characters",
        "GT_PATH": "/path/to/gt",
        "DBC_PATH": "/path/to/dbc",
        "DB2_PATH": "/path/to/db2"
      }
    }
  }
}
```

### Standard MCP Client Requirements

Any compatible MCP client should support:

1. **Transport**: stdio (standard input/output)
2. **Protocol**: JSON-RPC 2.0
3. **Server Launch**: Execute command with arguments
4. **Environment**: Pass environment variables to server process

### Configuration Steps (Generic)

1. **Find client configuration location** (check client documentation)
2. **Add server entry** with these fields:
   - `command`: `"node"`
   - `args`: Array with absolute path to `dist/index.js`
   - `env`: Object with environment variables
3. **Restart client** to load MCP server
4. **Test connection** by invoking any tool

### Testing MCP Server Manually

You can test the server with any MCP-compatible testing tool:

**Using MCP Inspector (if available):**
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

**Using manual stdio:**
```bash
# Start server
node dist/index.js

# Send JSON-RPC request (on stdin)
{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}

# Expected response (on stdout)
{"jsonrpc":"2.0","result":{"tools":[...]},"id":1}
```

### Environment Variable Priority

MCP servers receive environment variables in this order (highest priority first):

1. **Client config `env` section** - Directly specified in MCP client config
2. **System environment variables** - OS-level environment (from `${VAR}` references)
3. **Server `.env` file** - Local .env file in server directory (if loaded)

**Best Practice:** Use client config for server-specific settings, system environment for passwords.

---

## Advanced Configuration

### Multiple Environment Profiles

Create different configurations for different environments:

**Development Profile:**
```json
{
  "trinitycore-dev": {
    "command": "node",
    "args": ["C:\\Dev\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "dev_user",
      "TRINITY_DB_PASSWORD": "dev_password",
      "GT_PATH": "C:\\Dev\\data\\gt"
    }
  }
}
```

**Production Profile:**
```json
{
  "trinitycore-prod": {
    "command": "node",
    "args": ["C:\\Production\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "prod-server.example.com",
      "TRINITY_DB_USER": "readonly_user",
      "TRINITY_DB_PASSWORD": "${PROD_DB_PASSWORD}",
      "GT_PATH": "\\\\NetworkShare\\TrinityData\\gt"
    }
  }
}
```

### Remote Database Configuration

For remote MySQL servers:

```json
{
  "env": {
    "TRINITY_DB_HOST": "192.168.1.100",
    "TRINITY_DB_PORT": "3306",
    "TRINITY_DB_USER": "remote_user",
    "TRINITY_DB_PASSWORD": "${REMOTE_DB_PASSWORD}"
  }
}
```

**Network Requirements:**
- MySQL server must allow remote connections
- Firewall must allow port 3306
- User must have remote access permissions

### Network Share Data Paths

For data files on network shares:

**Windows UNC Paths:**
```json
{
  "env": {
    "GT_PATH": "\\\\FileServer\\TrinityData\\gt",
    "DBC_PATH": "\\\\FileServer\\TrinityData\\dbc",
    "DB2_PATH": "\\\\FileServer\\TrinityData\\db2"
  }
}
```

**Note:** Use 4 backslashes (`\\\\`) in JSON for UNC paths.

---

## Troubleshooting MCP Integration

### Issue: "MCP server not found" or "Failed to start"

**Diagnosis:**
```bash
# Test server manually
node C:\TrinityBots\trinitycore-mcp\dist\index.js

# Should output:
TrinityCore MCP Server running on stdio
```

**Common Causes:**
1. Wrong path to `index.js` in config
2. Node.js not in system PATH
3. Build not completed (`npm run build`)
4. Permissions issue on file

**Solutions:**
```bash
# Verify Node.js is accessible
node --version

# Verify file exists
dir C:\TrinityBots\trinitycore-mcp\dist\index.js

# Rebuild if needed
cd C:\TrinityBots\trinitycore-mcp
npm run build
```

### Issue: "Database connection failed"

**Check environment variables are passed correctly:**

Add debug logging to verify:
```json
{
  "env": {
    "TRINITY_DB_HOST": "localhost",
    "NODE_ENV": "development",
    "DEBUG": "trinitycore:*"
  }
}
```

**Test database connection separately:**
```bash
# Windows
mysql -h localhost -u trinity -p -e "USE world; SELECT COUNT(*) FROM spell_template;"

# Should return count without errors
```

### Issue: "GameTable file not found"

**Verify paths are correct and accessible:**
```bash
# Windows
dir "C:\TrinityServer\data\gt\CombatRatings.txt"

# Linux/macOS
ls -la /path/to/data/gt/CombatRatings.txt
```

**Check path format in config:**
- Windows JSON: `"C:\\TrinityServer\\data\\gt"` (double backslash)
- Linux/macOS JSON: `"/home/user/data/gt"` (forward slash)

### Issue: Client doesn't recognize environment variables

**Try direct values instead of `${VAR}` references:**

Instead of:
```json
"TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}"
```

Use:
```json
"TRINITY_DB_PASSWORD": "actual_password"
```

**Note:** Less secure, but helps diagnose environment variable issues.

### Issue: "Permission denied" on Linux/macOS

**Make node executable accessible:**
```bash
# Find node location
which node

# Ensure it's in PATH
echo $PATH

# Make sure user has execute permission
ls -la $(which node)
```

---

## Verification

### Test Database Connection

Create a test script `test-connection.js`:

```javascript
import { queryWorld } from './dist/database/connection.js';

try {
  const result = await queryWorld('SELECT COUNT(*) as count FROM spell_template LIMIT 1');
  console.log('✅ Database connection successful!');
  console.log('Result:', result);
  process.exit(0);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}
```

Run the test:
```bash
node test-connection.js
```

### Test MCP Server

In Claude Code, try these commands:

**Test 1: Get spell information**
```
Use the TrinityCore MCP to get information about spell ID 133 (Fireball)
```

**Expected response:** Spell details including name, description, effects

**Test 2: Query GameTable**
```
Use the TrinityCore MCP to query combat ratings for level 60
```

**Expected response:** Combat rating values (crit, haste, mastery, etc.)

**Test 3: Get talent build**
```
Use the TrinityCore MCP to get a recommended talent build for Arms Warrior (spec ID 71) for raiding
```

**Expected response:** Talent recommendations with tier-by-tier selections

### Verify All 21 Tools Available

In Claude Code:
```
List all available TrinityCore MCP tools
```

You should see **21 tools** across 3 phases:
- **Phase 1**: 6 foundation tools
- **Phase 2**: 7 core system tools
- **Phase 3**: 8 advanced feature tools

---

## Troubleshooting

### Issue: "Cannot find module 'mysql2'"

**Solution:**
```bash
npm install
```

### Issue: "Error: ER_ACCESS_DENIED_ERROR"

**Cause:** Incorrect database credentials

**Solution:**
1. Verify credentials in `.env` file
2. Test MySQL login:
   ```bash
   mysql -h localhost -u trinity -p
   ```
3. Grant permissions if needed:
   ```sql
   GRANT SELECT ON world.* TO 'trinity'@'localhost';
   GRANT SELECT ON auth.* TO 'trinity'@'localhost';
   GRANT SELECT ON characters.* TO 'trinity'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Issue: "GameTable file not found"

**Cause:** Incorrect GT_PATH or missing files

**Solution:**
1. Verify GT_PATH in `.env` points to correct directory
2. Check that GameTable files exist:
   ```bash
   # Windows
   dir "C:\TrinityServer\data\gt\CombatRatings.txt"

   # Linux/macOS
   ls -la /path/to/data/gt/CombatRatings.txt
   ```
3. See [Data File Setup](#data-file-setup) section

### Issue: "MCP server not showing in Claude Code"

**Solution:**
1. Verify `.claude/mcp-servers-config.json` syntax (use JSON validator)
2. Check absolute path to `dist/index.js` is correct
3. Restart Claude Code completely
4. Check Claude Code logs for errors

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Clean build
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

---

## Data File Setup

### GameTable (GT) Files

**Location:** TrinityCore server `data/gt/` directory

**Required files for full functionality:**
- `CombatRatings.txt` - Combat rating conversions
- `xp.txt` - Experience per level
- `BaseMp.txt` - Base mana per class/level
- `HpPerSta.txt` - Health per stamina point

**Where to get them:**
1. Included with TrinityCore server build
2. Extract from WoW client Data.casc
3. Download from TrinityCore resources

**Setup:**
```bash
# Copy from TrinityCore server installation
cp -r /path/to/trinitycore/server/data/gt /path/to/gt_files/
```

### DBC/DB2 Files (Optional)

**Location:** WoW client Data folder

**Extraction:**
1. Use **CascView** or **CASC Explorer**
2. Extract `DBFilesClient/` folder from `Data.casc`
3. Point DBC_PATH/DB2_PATH to extracted location

**Note:** DBC/DB2 functionality is optional. Most features use MySQL database.

---

## Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.template .env
# Edit .env with your settings

# 3. Build the server
npm run build

# 4. Configure Claude Code
# Edit .claude/mcp-servers-config.json

# 5. Restart Claude Code

# 6. Test in Claude Code
# "Use TrinityCore MCP to get spell info for ID 133"
```

---

## Next Steps

After successful installation:

1. **Read Documentation:**
   - `README.md` - Overview and tool reference
   - `PHASE2_COMPLETE.md` - Core systems documentation
   - `PHASE3_COMPLETE.md` - Advanced features documentation
   - `GAMETABLES_DOCUMENTATION.md` - GameTable reference

2. **Explore Features:**
   - Try talent optimization tools
   - Test quest route planning
   - Experiment with PvP composition analysis
   - Use collection management tools

3. **Integrate with Playerbot:**
   - Use MCP tools to enhance bot AI
   - Optimize bot talent builds
   - Plan bot leveling routes
   - Coordinate multi-bot groups

---

## Support and Contributing

### Getting Help

- **Issues**: Report bugs or request features
- **Documentation**: Check all `.md` files in this directory
- **Database**: Verify TrinityCore database is properly populated

### Security

- **Never** commit `.env` file to version control
- Use **read-only** database user for MCP server
- Store passwords in environment variables, not config files
- Review `.gitignore` to ensure sensitive files are excluded

---

**Installation Complete!** 🎉

You now have a fully functional TrinityCore MCP server with 21 enterprise-grade tools for bot development, game analysis, and strategy planning.

For detailed tool documentation, see `README.md` and the Phase 2/3 completion documents.
