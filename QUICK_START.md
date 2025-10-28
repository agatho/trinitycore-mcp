# TrinityCore MCP Server - Quick Start Guide

**Get up and running in 5 minutes!**

---

## Prerequisites Check

```bash
# Verify you have these installed:
node --version   # Should be v18.0.0 or higher
npm --version    # Should be v9.0.0 or higher
mysql --version  # Should be v8.0 or higher
```

---

## Installation (3 Steps)

### Step 1: Install Dependencies
```bash
cd C:\TrinityBots\trinitycore-mcp
npm install
```

### Step 2: Configure Environment
```bash
# Copy template
copy .env.template .env

# Edit .env and set:
# - TRINITY_DB_PASSWORD=your_password
# - GT_PATH=C:\TrinityServer\data\gt (or your path)
```

### Step 3: Build
```bash
npm run build
```

✅ Installation complete!

---

## Claude Code Setup (2 Steps)

### Step 1: Create Config File

**Location:** `%USERPROFILE%\.claude\mcp-servers-config.json`

**Windows:**
```json
{
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
```

**Linux/macOS:**
```json
{
  "trinitycore": {
    "command": "node",
    "args": ["/home/user/trinitycore-mcp/dist/index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_PORT": "3306",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "your_password_here",
      "TRINITY_DB_WORLD": "world",
      "GT_PATH": "/home/user/TrinityServer/data/gt"
    }
  }
}
```

### Step 2: Restart Claude Code

Close and reopen Claude Code.

✅ Claude Code configured!

---

## Claude Desktop Setup (2 Steps)

### Step 1: Edit Config File

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

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
        "GT_PATH": "C:\\TrinityServer\\data\\gt"
      }
    }
  }
}
```

### Step 2: Restart Claude Desktop

Quit completely (File → Quit) and relaunch.

✅ Claude Desktop configured!

---

## Test Your Installation

In Claude Code or Claude Desktop:

```
Use the TrinityCore MCP to get spell information for spell ID 133
```

Expected: Details about Fireball spell

```
List all available TrinityCore MCP tools
```

Expected: 21 tools listed

✅ **You're ready to go!**

---

## Common Issues

### "MCP server not found"
- Check absolute path in config
- Verify `npm run build` completed
- Test: `node C:\TrinityBots\trinitycore-mcp\dist\index.js`

### "Database connection failed"
- Check password in .env or config
- Test: `mysql -h localhost -u trinity -p`
- Verify database exists: `SHOW DATABASES;`

### "GameTable file not found"
- Check GT_PATH points to correct directory
- Verify files exist: `dir C:\TrinityServer\data\gt\*.txt`

---

## Path Cheat Sheet

**Windows Paths in JSON:**
```json
"C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"
```
(Double backslashes!)

**Linux/macOS Paths in JSON:**
```json
"/home/user/trinitycore-mcp/dist/index.js"
```
(Single forward slashes)

---

## Security Best Practice

**Instead of:**
```json
"TRINITY_DB_PASSWORD": "mypassword123"
```

**Use environment variable:**
```powershell
# Set once in PowerShell
[System.Environment]::SetEnvironmentVariable('TRINITY_DB_PASSWORD', 'mypassword123', 'User')
```

**Then in config:**
```json
"TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}"
```

---

## Available Tools (21 Total)

**Phase 1 - Foundation (6):**
- get-spell-info
- get-item-info
- get-quest-info
- query-dbc
- get-trinity-api
- get-opcode-info

**Phase 2 - Core Systems (7):**
- get-recommended-talent-build
- calculate-melee-damage
- get-buff-recommendations
- get-dungeon-strategy
- analyze-auction-item
- get-reputation-path
- coordinate-cooldowns

**Phase 3 - Advanced (8):**
- analyze-arena-composition
- get-battleground-strategy
- get-pvp-talent-build
- optimize-quest-route
- get-leveling-path
- get-collection-status
- find-missing-collectibles
- get-farming-route

---

## Need Help?

📖 **Full Documentation:**
- `INSTALLATION.md` - Complete installation guide
- `README.md` - Tool reference
- `PHASE2_COMPLETE.md` - Core systems docs
- `PHASE3_COMPLETE.md` - Advanced features docs

🐛 **Troubleshooting:**
See INSTALLATION.md → "Troubleshooting MCP Integration" section

---

**That's it! Happy bot developing! 🎉**
