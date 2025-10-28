# TrinityCore MCP Server

Custom Model Context Protocol server providing TrinityCore-specific tools for game data access, DBC/DB2 file reading, and API documentation.

## Features

### Phase 1: Foundation
- **Game Data Queries**: Query spells, items, quests, creatures from World database
- **DBC/DB2 Reading**: Parse and query client-side database files
- **GameTable (GT) Files**: Access critical game calculation tables
  - Combat ratings (crit, haste, mastery) per level
  - Experience required per level
  - Base mana per class and level
  - Health per stamina
  - Spell scaling factors
  - Item level calculations
  - Battle pet progression
- **Trinity API Docs**: Access TrinityCore C++ API documentation
- **Opcode Information**: Get packet opcode documentation and structure
- **Spell System**: Detailed spell data with effects, auras, and mechanics
- **Item Database**: Item properties, stats, and requirements
- **Quest System**: Quest chains, objectives, and rewards

### Phase 2: Core Systems
- **Talent Optimization**: Recommended talent builds for all specs and purposes (leveling, raid, PvP, dungeon)
- **Combat Mechanics**: Melee/spell damage calculations, armor mitigation, DPS estimates
- **Buff Optimization**: Optimal buff and consumable recommendations based on activity and budget
- **Dungeon/Raid Strategy**: Boss mechanics, pull strategies, trash routes, loot priorities
- **Economy/Auction House**: Item pricing analysis, market trends, crafting profitability
- **Reputation System**: Optimal reputation grinding paths with time estimates
- **Multi-Bot Coordination**: Raid cooldown coordination, formation management, group synergy

### Phase 3: Advanced Features
- **PvP Arena/BG Tactician**: Arena composition analysis, battleground strategies, PvP talent builds
- **Quest Route Optimizer**: Optimal quest routing, leveling paths, XP/hour calculations
- **Collection Manager**: Pet/mount/toy tracking, farming routes, completion planning

## Installation

```bash
cd C:\TrinityBots\trinity-mcp-server
npm install
npm run build
```

## Configuration

Create `.env` file:
```env
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password
TRINITY_ROOT=C:\TrinityBots\TrinityCore
DBC_PATH=C:\TrinityBots\Server\data\dbc
DB2_PATH=C:\TrinityBots\Server\data\db2
MCP_PORT=3000
```

## Usage

### Start Server
```bash
npm start
```

### Configure in Claude Code

Add to `.claude/mcp-servers-config.json`:
```json
{
  "trinitycore": {
    "command": "node",
    "args": ["C:\\TrinityBots\\trinity-mcp-server\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}"
    }
  }
}
```

## Available Tools

**Total: 21 MCP Tools** across 3 development phases

### Phase 1: Foundation Tools (6 tools)

#### get-spell-info
Get detailed spell information:
```json
{
  "spellId": 1234
}
```

#### get-item-info
Get item data:
```json
{
  "itemId": 5678
}
```

#### get-quest-info
Get quest information:
```json
{
  "questId": 9012
}
```

#### query-dbc
Query DBC file:
```json
{
  "dbcFile": "Spell.dbc",
  "recordId": 1234
}
```

#### get-trinity-api
Get TrinityCore API documentation:
```json
{
  "className": "Player"
}
```

#### get-opcode-info
Get opcode documentation:
```json
{
  "opcode": "CMSG_CAST_SPELL"
}
```

### Phase 2: Core Systems (7 tools)

#### get-recommended-talent-build
Get optimized talent build for a specialization:
```json
{
  "specId": 71,
  "purpose": "raid",
  "playerLevel": 60
}
```

#### calculate-melee-damage
Calculate expected melee damage output:
```json
{
  "weaponDPS": 150.5,
  "attackSpeed": 2.6,
  "attackPower": 2500,
  "critRating": 1200,
  "level": 60
}
```

#### get-buff-recommendations
Get optimal buff and consumable recommendations:
```json
{
  "classId": 1,
  "specId": 71,
  "activity": "raid",
  "budget": "medium"
}
```

#### get-dungeon-strategy
Get comprehensive dungeon/raid strategy:
```json
{
  "dungeonId": 36,
  "difficulty": "heroic",
  "groupComp": ["tank", "healer", "dps", "dps", "dps"]
}
```

#### analyze-auction-item
Analyze auction house pricing and trends:
```json
{
  "itemId": 172230,
  "realm": "Area-52"
}
```

#### get-reputation-path
Get optimal reputation grinding path:
```json
{
  "factionId": 1134,
  "currentStanding": "friendly",
  "targetStanding": "exalted"
}
```

#### coordinate-cooldowns
Coordinate raid cooldowns across multiple bots:
```json
{
  "bots": [
    {
      "name": "BotTank",
      "classId": 1,
      "role": "tank",
      "cooldowns": [...]
    }
  ],
  "encounterDuration": 300
}
```

### Phase 3: Advanced Features (8 tools)

#### analyze-arena-composition
Analyze PvP arena team composition:
```json
{
  "bracket": "3v3",
  "team": [
    {
      "classId": 4,
      "className": "Rogue",
      "specId": 259,
      "role": "melee_dps",
      "rating": 2400
    }
  ],
  "rating": 2400
}
```

#### get-battleground-strategy
Get battleground strategy and tactics:
```json
{
  "bgId": 2
}
```

#### get-pvp-talent-build
Get PvP-optimized talent build:
```json
{
  "specId": 259,
  "bracket": "3v3"
}
```

#### optimize-quest-route
Optimize quest completion route for a zone:
```json
{
  "zoneId": 14,
  "playerLevel": 20,
  "maxQuests": 30
}
```

#### get-leveling-path
Get optimal multi-zone leveling path:
```json
{
  "startLevel": 10,
  "targetLevel": 60,
  "faction": "alliance"
}
```

#### get-collection-status
Get collection progress status:
```json
{
  "type": "mount",
  "accountId": 1
}
```

#### find-missing-collectibles
Find missing collectibles by rarity:
```json
{
  "type": "pet",
  "minRarity": "rare"
}
```

#### get-farming-route
Get optimized farming route for a collectible:
```json
{
  "collectibleId": 32768,
  "type": "mount"
}
```

### GameTable Tools

#### query-gametable
Query a GameTable file:
```json
{
  "tableName": "CombatRatings.txt",
  "rowId": 60,
  "maxRows": 100
}
```

#### list-gametables
List all available GameTables:
```json
{}
```

#### get-combat-rating
Get combat rating for a level:
```json
{
  "level": 60,
  "statName": "Crit - Melee"
}
```

#### get-character-stats
Get character stats for a level:
```json
{
  "level": 60,
  "className": "Mage"
}
```

## Development

### Project Structure
```
trinity-mcp-server/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── tools/
│   │   ├── spell.ts       # Spell-related tools
│   │   ├── item.ts        # Item-related tools
│   │   ├── quest.ts       # Quest-related tools
│   │   ├── dbc.ts         # DBC/DB2 reader
│   │   ├── api.ts         # Trinity API docs
│   │   └── opcode.ts      # Opcode documentation
│   ├── database/
│   │   ├── connection.ts  # MySQL connection
│   │   └── queries.ts     # SQL queries
│   └── utils/
│       ├── parser.ts      # DBC/DB2 parser
│       └── cache.ts       # Caching layer
├── package.json
├── tsconfig.json
└── README.md
```

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Test
```bash
npm test
```

## Examples

### Query Spell Data
```typescript
// Get Fireball spell
const fireball = await tools.getSpellInfo({ spellId: 133 });
console.log(fireball.name); // "Fireball"
console.log(fireball.effects); // Array of spell effects
```

### Read DBC File
```typescript
// Read spell DBC record
const spellRecord = await tools.queryDBC({
  dbcFile: "Spell.dbc",
  recordId: 133
});
```

### Get API Documentation
```typescript
// Get Player class API
const playerAPI = await tools.getTrinityAPI({
  className: "Player"
});
console.log(playerAPI.methods); // Available methods
```

## License

GPL-2.0 (same as TrinityCore)

## Contributing

Contributions welcome! Please follow TrinityCore coding standards.

## Support

For issues or questions, create an issue in the Playerbot repository.
