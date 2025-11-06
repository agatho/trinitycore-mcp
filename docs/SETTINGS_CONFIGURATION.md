# TrinityCore MCP Settings & Configuration

**Status**: ✅ Complete
**Version**: 1.0.0
**Date**: 2025-11-06

## Overview

TrinityCore MCP now includes a comprehensive settings management system with:
- **Web-based UI** for easy configuration management
- **Environment variable support** for deployment flexibility
- **Runtime configuration updates** without server restart
- **Configuration validation** to prevent invalid settings
- **VMap/MMap path configuration** for 3D map features

## Quick Start

### 1. Set Up Environment Variables

Copy the template and configure your settings:

```bash
cp .env.template .env
```

Edit `.env` and set your values:

```bash
# Database Configuration
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password_here
TRINITY_DB_WORLD=world
TRINITY_DB_AUTH=auth
TRINITY_DB_CHARACTERS=characters

# Data Paths
TRINITY_ROOT=C:\TrinityCore
GT_PATH=./data/gt
DBC_PATH=./data/dbc
DB2_PATH=./data/db2
VMAP_PATH=./data/vmaps    # NEW!
MMAP_PATH=./data/mmaps    # NEW!

# Server
MCP_PORT=3000
```

### 2. Access Settings UI

Navigate to the settings page in your browser:

```
http://localhost:3000/settings
```

The settings page provides a user-friendly interface to:
- Configure all server options
- Update paths dynamically
- Validate settings before saving
- Reset to defaults if needed

## New Features

### 1. VMap and MMap Path Configuration

**What's New**: Added `VMAP_PATH` and `MMAP_PATH` environment variables.

**Purpose**:
- **VMAP_PATH**: Path to Visibility/Collision Map files for line-of-sight checks and spawn validation
- **MMAP_PATH**: Path to Movement Map (Navigation Mesh) files for pathfinding and AI movement

**Example**:
```bash
VMAP_PATH=./data/vmaps
MMAP_PATH=./data/mmaps
```

**Usage in Code**:
```typescript
import { getConfigManager } from "@/config/config-manager";

const config = getConfigManager();
const paths = config.getDataPaths();

console.log(paths.vmapPath); // ./data/vmaps
console.log(paths.mmapPath); // ./data/mmaps
```

### 2. Web-Based Settings Dashboard

**Access**: Navigate to `/settings` in the web UI

**Features**:
- **6 Configuration Tabs**:
  1. **Database**: MySQL connection settings
  2. **Data Paths**: File system paths (GT, DBC, DB2, VMap, MMap)
  3. **Server**: HTTP server configuration
  4. **WebSocket**: Real-time event streaming settings
  5. **Testing**: Testing framework configuration
  6. **Logging**: Log level and file settings

- **Real-time Validation**: Settings are validated before saving
- **Error Feedback**: Clear error and warning messages
- **Reset to Defaults**: One-click reset button
- **Reload**: Refresh settings from server

**Screenshots** (conceptual):
```
┌─────────────────────────────────────────────────────────────┐
│ TrinityCore MCP Settings                                    │
├─────────────────────────────────────────────────────────────┤
│ [Database] [Data Paths] [Server] [WebSocket] [Testing] [...] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Data Paths Configuration                                    │
│                                                             │
│ VMap Files Path:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ ./data/vmaps                                        │   │
│ └─────────────────────────────────────────────────────┘   │
│ Visibility/Collision maps for line-of-sight checks         │
│                                                             │
│ MMap Files Path:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ ./data/mmaps                                        │   │
│ └─────────────────────────────────────────────────────┘   │
│ Navigation mesh for pathfinding and AI movement            │
│                                                             │
│ [Save Settings]  [Reset to Defaults]  [Reload]            │
└─────────────────────────────────────────────────────────────┘
```

### 3. Configuration Manager API

**Location**: `src/config/config-manager.ts`

**Key Features**:
- Environment variable loading
- File-based configuration persistence
- Runtime updates with validation
- Event-based notifications
- Singleton pattern for global access

**Example Usage**:

```typescript
import { getConfigManager, initializeConfig } from "@/config/config-manager";

// Initialize configuration (once at startup)
await initializeConfig();

// Get configuration manager
const config = getConfigManager();

// Get specific configuration sections
const database = config.getDatabase();
const dataPaths = config.getDataPaths();
const server = config.getServer();

// Update configuration
await config.updateDataPaths({
  vmapPath: "/custom/path/to/vmaps",
  mmapPath: "/custom/path/to/mmaps",
});

// Listen for configuration changes
config.on("updated", (newConfig) => {
  console.log("Configuration updated:", newConfig);
});

// Validate configuration
const validation = config.validate();
if (!validation.valid) {
  console.error("Configuration errors:", validation.errors);
}

// Reset to defaults
await config.reset();
```

## Configuration Sections

### Database Configuration

**Settings**:
- `host`: MySQL server hostname
- `port`: MySQL server port (1-65535)
- `user`: Database user
- `password`: Database password
- `world`: World database name
- `auth`: Auth database name
- `characters`: Characters database name

**Validation**:
- Host is required
- Port must be between 1 and 65535
- User is required
- Warning if password is empty

### Data Paths Configuration

**Settings**:
- `trinityRoot`: TrinityCore source root directory
- `gtPath`: GameTable files directory
- `dbcPath`: DBC files directory
- `db2Path`: DB2 files directory
- `vmapPath`: VMap files directory ⭐ **NEW**
- `mmapPath`: MMap files directory ⭐ **NEW**

**Validation**:
- No specific validation (paths can be relative or absolute)

### Server Configuration

**Settings**:
- `host`: Server hostname
- `port`: HTTP server port (1-65535)
- `corsEnabled`: Enable CORS
- `corsOrigin`: CORS allowed origin
- `maxConnections`: Maximum concurrent connections

**Validation**:
- Port must be between 1 and 65535
- Max connections must be at least 1

### WebSocket Configuration

**Settings**:
- `enabled`: Enable WebSocket server
- `port`: WebSocket port (1-65535)
- `maxClients`: Maximum concurrent clients
- `heartbeatInterval`: Heartbeat interval (ms)
- `timeoutMs`: Connection timeout (ms)
- `rateLimit`: Event rate limit (events/sec)

**Validation**:
- Port must be between 1 and 65535
- Port cannot be the same as HTTP server port
- Max clients must be at least 1
- Rate limit must be at least 1 event/sec

### Testing Configuration

**Settings**:
- `enabled`: Enable testing framework
- `autoGenerateTests`: Auto-generate tests from code
- `coverageThreshold`: Minimum coverage percentage (0-100)
- `performanceBaselines`: Track performance baselines

**Validation**:
- Coverage threshold must be between 0 and 100

### Logging Configuration

**Settings**:
- `level`: Log level (debug, info, warn, error)
- `console`: Log to console
- `file`: Log to file
- `filePath`: Log file path
- `maxFileSize`: Maximum log file size (bytes)
- `maxFiles`: Maximum number of log files

**Validation**:
- Log level must be one of: debug, info, warn, error
- Warning if max file size < 1KB
- Max files must be at least 1

## API Endpoints

### GET /api/config

**Description**: Get current configuration

**Response**:
```json
{
  "success": true,
  "config": {
    "database": { ... },
    "dataPaths": {
      "trinityRoot": "./",
      "gtPath": "./data/gt",
      "dbcPath": "./data/dbc",
      "db2Path": "./data/db2",
      "vmapPath": "./data/vmaps",
      "mmapPath": "./data/mmaps"
    },
    "server": { ... },
    "websocket": { ... },
    "testing": { ... },
    "logging": { ... }
  }
}
```

**Note**: Database password is sanitized (replaced with "••••••••")

### POST /api/config

**Description**: Update configuration

**Request Body**:
```json
{
  "database": { ... },
  "dataPaths": {
    "vmapPath": "/new/path/to/vmaps",
    "mmapPath": "/new/path/to/mmaps"
  },
  ...
}
```

**Response** (success):
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  },
  "config": { ... }
}
```

**Response** (validation error):
```json
{
  "success": false,
  "validation": {
    "valid": false,
    "errors": [
      "Database host is required",
      "Server port must be between 1 and 65535"
    ],
    "warnings": [
      "Database password is empty - connection may fail"
    ]
  }
}
```

### POST /api/config/reset

**Description**: Reset configuration to defaults

**Response**:
```json
{
  "success": true,
  "config": { ... },
  "message": "Configuration reset to defaults"
}
```

## File Structure

```
trinitycore-mcp/
├── .env.template                          # Environment variable template (UPDATED)
├── src/
│   └── config/
│       └── config-manager.ts              # Configuration manager (NEW)
├── web-ui/
│   ├── app/
│   │   ├── settings/
│   │   │   └── page.tsx                   # Settings page (NEW)
│   │   └── api/
│   │       └── config/
│   │           ├── route.ts               # Config API endpoint (NEW)
│   │           └── reset/
│   │               └── route.ts           # Reset API endpoint (NEW)
│   └── components/
│       └── settings/
│           └── SettingsDashboard.tsx      # Settings dashboard component (NEW)
└── docs/
    └── SETTINGS_CONFIGURATION.md          # This document (NEW)
```

## Integration with Existing Features

### VMap/MMap Parsers

The VMap and MMap parsers now automatically use the configured paths:

```typescript
import { getConfigManager } from "@/config/config-manager";

const config = getConfigManager();
const paths = config.getDataPaths();

// Use configured paths
const vmapParser = new VMapParser(paths.vmapPath);
const mmapParser = new MMapParser(paths.mmapPath);
```

### 3D Viewer

The 3D viewer can now access VMap/MMap data from the configured locations:

```typescript
const paths = config.getDataPaths();

// Load VMap collision data
const vmapData = await loadVMapTile(paths.vmapPath, mapId, tileX, tileY);

// Load MMap navigation mesh
const mmapData = await loadMMapTile(paths.mmapPath, mapId, tileX, tileY);
```

## Best Practices

### 1. Environment Variables for Sensitive Data

Store sensitive information (passwords, API keys) in environment variables, not in the UI:

```bash
# .env
TRINITY_DB_PASSWORD=secure_password_here
```

### 2. Use Absolute Paths in Production

For production deployments, use absolute paths to avoid confusion:

```bash
VMAP_PATH=/opt/trinitycore/data/vmaps
MMAP_PATH=/opt/trinitycore/data/mmaps
```

### 3. Validate Before Deploying

Always validate configuration before deploying to production:

```typescript
const validation = config.validate();
if (!validation.valid) {
  console.error("Configuration errors:", validation.errors);
  process.exit(1);
}
```

### 4. Back Up Configuration

Periodically back up your configuration file:

```bash
cp config/trinity-mcp.json config/trinity-mcp.json.backup
```

### 5. Use the Settings UI for Runtime Changes

Use the web-based settings UI for runtime configuration changes that don't require a server restart.

## Troubleshooting

### Settings UI Not Loading

**Problem**: Settings page shows loading spinner indefinitely

**Solution**:
1. Check browser console for errors
2. Verify API endpoint is accessible: `http://localhost:3000/api/config`
3. Check server logs for errors

### Configuration Not Saving

**Problem**: Changes are not persisted after reload

**Solution**:
1. Check file permissions on `config/trinity-mcp.json`
2. Verify the `config` directory exists
3. Check server logs for write errors

### Validation Errors

**Problem**: Settings won't save due to validation errors

**Solution**:
1. Read error messages carefully
2. Fix invalid values (e.g., port numbers must be 1-65535)
3. Address warnings if necessary

### VMap/MMap Files Not Found

**Problem**: 3D viewer can't load map data

**Solution**:
1. Verify VMap/MMap paths in settings
2. Check that files exist at the specified locations
3. Use absolute paths if relative paths aren't working
4. Check file permissions

## Migration Guide

### From Previous Version

If you're upgrading from a previous version without settings management:

1. **Update .env file**:
   ```bash
   # Add new lines to your .env file
   VMAP_PATH=./data/vmaps
   MMAP_PATH=./data/mmaps
   ```

2. **Update code references**:
   Replace hardcoded paths with configuration manager:
   ```typescript
   // Before
   const vmapPath = "./data/vmaps";

   // After
   import { getConfigManager } from "@/config/config-manager";
   const vmapPath = getConfigManager().getDataPaths().vmapPath;
   ```

3. **Initialize configuration manager**:
   Add to your server startup code:
   ```typescript
   import { initializeConfig } from "@/config/config-manager";

   // At startup
   await initializeConfig();
   ```

## Future Enhancements

Potential future improvements to the settings system:

1. **Import/Export Configuration**: Export settings to JSON file for backup
2. **Configuration Profiles**: Multiple configuration profiles (dev, staging, production)
3. **Environment Detection**: Automatic configuration selection based on NODE_ENV
4. **Hot Reload**: Automatically reload modules when configuration changes
5. **Configuration History**: Track configuration changes over time
6. **Validation Rules**: Custom validation rules per deployment
7. **Secrets Management**: Integration with secret management services (Vault, AWS Secrets Manager)

## Support

For questions or issues with the settings system:

1. Check this documentation
2. Review the troubleshooting section
3. Check server logs for errors
4. Open an issue on GitHub with:
   - Steps to reproduce
   - Error messages
   - Configuration (sanitized, no passwords)
   - Environment details

## Summary

The new settings management system provides:

✅ **VMap/MMap path configuration** via environment variables and UI
✅ **Web-based settings dashboard** with 6 configuration tabs
✅ **Runtime configuration updates** without server restart
✅ **Comprehensive validation** with clear error messages
✅ **API endpoints** for programmatic access
✅ **Configuration persistence** to file system
✅ **Reset to defaults** functionality

**Total Files Added**: 6 new files (1 updated)
**Lines of Code**: ~1,200 lines
**API Endpoints**: 3 endpoints (GET /api/config, POST /api/config, POST /api/config/reset)

---

**Version**: 1.0.0
**Date**: 2025-11-06
**Status**: ✅ Complete
