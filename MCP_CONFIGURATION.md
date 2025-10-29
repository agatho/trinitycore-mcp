# TrinityCore MCP Server - Claude Code Configuration

This guide explains how to configure the TrinityCore MCP Server for use with Claude Code.

## Prerequisites

1. **Build the MCP Server**:
   ```bash
   cd C:\TrinityBots\trinitycore-mcp
   npm install
   npm run build
   ```

2. **Create `.env` file** with your TrinityCore database credentials:
   ```env
   TRINITY_DB_HOST=localhost
   TRINITY_DB_PORT=3306
   TRINITY_DB_USER=trinity
   TRINITY_DB_PASSWORD=your_password
   TRINITY_ROOT=C:\TrinityBots\TrinityCore
   DBC_PATH=C:\TrinityBots\Server\data\dbc
   DB2_PATH=C:\TrinityBots\Server\data\db2
   ```

## Claude Code Configuration

### Option 1: Using MCP Servers Config File (Recommended)

Create or edit `.claude/mcp-servers-config.json` in your project root:

```json
{
  "trinitycore-mcp": {
    "command": "node",
    "args": ["C:\TrinityBots\trinitycore-mcp\dist\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_PORT": "3306",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "your_password",
      "TRINITY_ROOT": "C:\TrinityBots\TrinityCore",
      "DBC_PATH": "C:\TrinityBots\Server\data\dbc",
      "DB2_PATH": "C:\TrinityBots\Server\data\db2"
    }
  }
}
```

**Important Notes:**
- Use double backslashes (`\`) in Windows paths
- Replace `your_password` with your actual database password
- Adjust paths to match your installation directories

### Option 2: Using npx (Alternative)

If you've published the package to npm, you can use:

```json
{
  "trinitycore-mcp": {
    "command": "npx",
    "args": ["-y", "@trinitycore/mcp-server"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "your_password"
    }
  }
}
```

### Option 3: Using bin entry (After npm install -g)

After globally installing:
```bash
npm install -g .
```

You can use:
```json
{
  "trinitycore-mcp": {
    "command": "trinitycore-mcp",
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "your_password"
    }
  }
}
```

## Verification

After configuration, restart Claude Code and verify the MCP server is loaded:

1. Open Claude Code
2. Check MCP servers list - you should see `trinitycore-mcp`
3. Test a tool:
   ```
   Use the get-trinity-api tool to get Player class documentation
   ```

## Available Tools

The MCP server provides 21 tools across 3 phases:

### Phase 1: Foundation Tools
- `get-spell-info` - Query spell data
- `get-item-info` - Query item data
- `get-quest-info` - Query quest data
- `query-dbc` - Query DBC/DB2 files
- `get-trinity-api` - Get C++ API documentation
- `get-opcode-info` - Get network opcode info

### Phase 2: Core Systems
- `get-talent-build` - Get recommended talent builds
- `calculate-melee-damage` - Calculate damage output
- `get-buff-recommendations` - Optimize buffs and consumables
- `get-boss-mechanics` - Get boss strategies
- `get-item-pricing` - Analyze auction house prices
- `get-reputation-standing` - Calculate reputation levels
- `coordinate-cooldowns` - Coordinate raid cooldowns

### Phase 3: Advanced Features
- `analyze-arena-composition` - PvP team analysis
- `get-battleground-strategy` - Battleground tactics
- `get-pvp-talent-build` - PvP talent optimization
- `optimize-quest-route` - Quest route optimization
- `get-leveling-path` - Multi-zone leveling paths
- `get-collection-status` - Collection progress tracking
- `find-missing-collectibles` - Find missing pets/mounts/toys
- `get-farming-route` - Optimized farming routes

## Troubleshooting

### MCP Server Not Appearing in Claude Code

1. **Check paths**: Ensure all paths in config use double backslashes on Windows
2. **Rebuild**: Run `npm run build` to ensure dist/ is up to date
3. **Check logs**: Look for error messages in Claude Code console
4. **Verify Node version**: Requires Node.js 18+
5. **Test directly**:
   ```bash
   node C:\TrinityBots\trinitycore-mcp\dist\index.js
   ```

### Database Connection Errors

1. Verify MySQL is running
2. Check credentials in `.env` or MCP config
3. Ensure database user has SELECT permissions on TrinityCore databases
4. Test connection:
   ```bash
   mysql -u trinity -p -h localhost
   ```

### Tool Execution Errors

1. Check that database is populated with TrinityCore data
2. Verify DBC/DB2 paths point to correct client data
3. Review error messages for specific issues

## Example Usage

Once configured, you can use the MCP tools in Claude Code:

```
# Get spell information
"What are the details of spell ID 133 (Fireball)?"

# Optimize talent build
"What's the optimal talent build for Arms Warrior in raids?"

# Analyze arena comp
"Analyze this 3v3 composition: Rogue, Mage, Priest"

# Quest routing
"Optimize quest routes for Westfall at level 15"
```

## Environment Variables

All supported environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRINITY_DB_HOST` | Yes | - | MySQL host |
| `TRINITY_DB_PORT` | No | 3306 | MySQL port |
| `TRINITY_DB_USER` | Yes | - | Database user |
| `TRINITY_DB_PASSWORD` | Yes | - | Database password |
| `TRINITY_ROOT` | No | - | TrinityCore source root |
| `DBC_PATH` | No | - | Path to DBC files |
| `DB2_PATH` | No | - | Path to DB2 files |
| `MCP_PORT` | No | 3000 | MCP server port (unused for stdio) |

## Security Notes

- **Never commit** `.env` files or config with passwords to git
- Use environment variables or secure password management
- The MCP server has **read-only** database access
- No write operations to game database are performed

## Support

For issues or questions:
- GitHub Issues: https://github.com/agatho/trinitycore-mcp/issues
- TrinityCore Discord: Ask in #playerbot-development

## Updates

To update the MCP server:

```bash
cd C:\TrinityBots\trinitycore-mcp
git pull
npm install
npm run build
```

Restart Claude Code after updating.
