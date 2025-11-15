# Automatic Profile Detection - User Guide

**Zero-Configuration MCP Tool Management**

---

## Overview

The TrinityCore MCP Server now features **automatic profile detection** that intelligently selects the optimal tool profile based on your client type, eliminating the need for manual configuration.

### The Problem We Solved

**Before:** Claude Code consumed ~75,500 tokens from 111 MCP tools, exceeding the 25,000 token threshold by 3x.

**After:** Automatic detection reduces token usage to 6,800-10,000 tokens (91% reduction) for Claude Code while maintaining full functionality for Web UI.

---

## How It Works

### Zero-Configuration Operation

When you start the MCP server **without any environment variables**, the system:

1. **Detects your client type** automatically
2. **Selects the optimal profile** for your client
3. **Loads only necessary tools** to minimize token usage
4. **Maintains full backward compatibility**

### Client Detection

The system detects your client type by examining environment variables:

| Client Type | Detection Method | Auto-Selected Profile |
|-------------|------------------|----------------------|
| **Web UI** | `MCP_MODE=webui` | FULL (all 111 tools) |
| **Claude Code** | `CLAUDE_CODE_VERSION` or `VSCODE_PID` | DYNAMIC (10 tools, on-demand loading) |
| **MCP Inspector** | `MCP_INSPECTOR=true` | FULL (all 111 tools) |
| **Unknown** | No matching env vars | FULL (safe default) |

---

## Usage Examples

### For Web UI Users

**No Configuration Needed!**

```bash
# Just start normally - auto-detects Web UI and loads all tools
npm run start:all
```

**Output:**
```
[ProfileLoader] Using full profile for Web UI mode

┌─────────────────────────────────────────────────────────────┐
│ MCP Tool Profile Loader                                     │
├─────────────────────────────────────────────────────────────┤
│ Profile:          full                                      │
│ Tools:            111                                       │
│ Est. Tokens:      ~75480                                    │
└─────────────────────────────────────────────────────────────┘

[MCP Server] Loaded 111 / 111 tools based on profile
```

### For Claude Code Users

**No Configuration Needed!**

The system automatically detects Claude Code and selects the DYNAMIC profile (minimal with on-demand loading).

**Output:**
```
[ProfileLoader] Auto-detected profile: dynamic (Claude Code benefits from minimal profile with on-demand loading)
[ProfileLoader] Client type: claude-code, Confidence: 90%

┌─────────────────────────────────────────────────────────────┐
│ MCP Tool Profile Loader                                     │
├─────────────────────────────────────────────────────────────┤
│ Client Type:      Auto-detected: claude-code               │
│ Profile:          dynamic                                   │
│ Tools:            10                                        │
│ Est. Tokens:      ~6800                                     │
│ Token Reduction:  91.8% ↓                                   │
└─────────────────────────────────────────────────────────────┘

[MCP Server] Loaded 10 / 111 tools based on profile
```

### For MCP Inspector Users

**No Configuration Needed!**

```bash
# Set inspector flag (if not set automatically)
MCP_INSPECTOR=true npm run start:mcp
```

**Output:**
```
[ProfileLoader] Auto-detected profile: full (Inspector tool benefits from seeing all available tools)
[ProfileLoader] Client type: inspector, Confidence: 80%

┌─────────────────────────────────────────────────────────────┐
│ MCP Tool Profile Loader                                     │
├─────────────────────────────────────────────────────────────┤
│ Client Type:      Auto-detected: inspector                 │
│ Profile:          full                                      │
│ Tools:            111                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Manual Override (Optional)

If you want to **override** auto-detection and use a specific profile:

### Override with Explicit Profile

```bash
# Use specific profile
MCP_PROFILE=playerbot-dev npm run start:mcp
```

Available profiles:
- `full` - All 111 tools (~75,480 tokens)
- `core-data` - Essential game data (10 tools, ~6,800 tokens)
- `code-review` - Code analysis (8 tools, ~5,440 tokens)
- `playerbot-dev` - Bot development (27 tools, ~18,360 tokens)
- `performance` - Performance analysis (9 tools, ~6,120 tokens)
- `database` - Database operations (11 tools, ~7,480 tokens)
- `dynamic` - Start minimal, load on demand (10 tools)

### Override with Mode Setting

```bash
# Force Web UI mode (all tools)
MCP_MODE=webui npm run start:mcp

# Force Claude Code mode (minimal tools)
MCP_MODE=claude-code npm run start:mcp
```

---

## Profile Selection Priority

The system uses this priority order (highest to lowest):

1. **Explicit Profile** (`MCP_PROFILE=full`) → **Highest Priority**
2. **Explicit Mode** (`MCP_MODE=webui` or `MCP_MODE=claude-code`)
3. **Auto-Detection** (environment variable analysis)
4. **Safe Default** (FULL profile) → **Lowest Priority**

This ensures that:
- ✅ Explicit configuration always wins
- ✅ Auto-detection only activates when no explicit config
- ✅ Safe default prevents breaking changes

---

## Token Reduction Examples

### Claude Code (Auto-Detected)

**Before:** 111 tools × ~680 tokens/tool = ~75,480 tokens
**After:** 10 tools × ~680 tokens/tool = ~6,800 tokens
**Reduction:** 91.8% ↓

### Playerbot Development Profile

**Before:** 111 tools × ~680 tokens/tool = ~75,480 tokens
**After:** 27 tools × ~680 tokens/tool = ~18,360 tokens
**Reduction:** 75.7% ↓

### Code Review Profile

**Before:** 111 tools × ~680 tokens/tool = ~75,480 tokens
**After:** 8 tools × ~680 tokens/tool = ~5,440 tokens
**Reduction:** 92.8% ↓

---

## Environment Variables Reference

### Auto-Detection Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CLAUDE_CODE_VERSION` | Detects Claude Code client | `1.0.0` |
| `VSCODE_PID` | Detects VSCode/Claude Code | `12345` |
| `MCP_INSPECTOR` | Detects MCP Inspector tool | `true` |
| `MCP_CLIENT_TYPE` | Explicit client type override | `claude-code` |

### Configuration Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `MCP_MODE` | Explicit mode selection | `webui`, `claude-code` |
| `MCP_PROFILE` | Explicit profile selection | `full`, `core-data`, `playerbot-dev` |
| `MCP_LAZY_LOAD` | Enable dynamic loading (future) | `true`, `false` |
| `MCP_CUSTOM_TOOLS` | Additional tools to load | `tool1,tool2,tool3` |
| `MCP_EXCLUDE_TOOLS` | Tools to exclude | `tool4,tool5` |

---

## Migration Guide

### Existing Deployments

**No action required!** The system is fully backward compatible:

1. **No env vars set** → Auto-detects → FULL profile (all tools)
2. **Existing `.mcp.json`** → Explicit overrides continue to work
3. **Web UI** → Still uses `MCP_MODE=webui` (all tools)
4. **No behavioral changes** → Everything works as before

### New Deployments

**Just start the server!** Auto-detection handles everything:

```bash
npm run start:mcp
# Automatically detects your client and selects optimal profile
```

---

## Troubleshooting

### Auto-Detection Not Working?

**Check startup logs** for detection information:

```bash
# Look for these log lines:
[ProfileLoader] Auto-detected profile: dynamic (...)
[ProfileLoader] Client type: claude-code, Confidence: 90%
```

**If auto-detection failed:**
- Check environment variables: `printenv | grep -i claude`
- Check for explicit overrides: `printenv | grep MCP_`
- Use explicit configuration: `MCP_MODE=claude-code npm run start:mcp`

### Wrong Profile Selected?

**Override with explicit configuration:**

```bash
# Explicitly set profile
MCP_PROFILE=playerbot-dev npm run start:mcp

# Or explicitly set mode
MCP_MODE=claude-code npm run start:mcp
```

### Want to See All Tools?

**Use FULL profile:**

```bash
MCP_PROFILE=full npm run start:mcp
# Loads all 111 tools regardless of client type
```

---

## Testing Auto-Detection

### Run the Test Suite

```bash
cd c:/TrinityBots/trinitycore-mcp
node scripts/test-auto-detection.js
```

**Expected Output:**
```
=================================================================
AUTO-DETECTION INTEGRATION TEST
=================================================================

Test 1: Explicit Profile Override
  ✅ PASS: Profile full selected correctly

Test 2: Auto-Detect Claude Code
  Auto-detected client type: claude-code
  ✅ PASS: Profile dynamic selected correctly

... (7 tests total)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL TESTS PASSED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Benefits

### For Users
- ✅ **Zero configuration** - Just start and go
- ✅ **Optimal performance** - Right profile for your client
- ✅ **Token reduction** - Up to 91% fewer tokens
- ✅ **Backward compatible** - Existing configs still work

### For Developers
- ✅ **Automatic optimization** - No manual profile selection
- ✅ **Intelligent defaults** - Safe fallbacks for unknown clients
- ✅ **Extensible** - Easy to add new client types
- ✅ **Analytics ready** - Usage tracking for smart recommendations

---

## Future Enhancements (Phase 4)

### Runtime Profile Switching
- Switch profiles during session
- Dynamic tool loading/unloading
- Usage-based profile recommendations

### Smart Recommendations
- Analyze actual tool usage patterns
- Suggest optimal profile based on usage
- Automatic profile optimization

### MCP Protocol Extensions
- Admin API for profile management
- Tool usage analytics dashboard
- Custom profile creation UI

---

## Technical Details

For detailed technical information, see:

- **LAZY_LOAD_PROPOSAL.md** - Architecture and design
- **PHASE1_COMPLETE.md** - Profile system infrastructure
- **PHASE2_COMPLETE.md** - Conditional tool registration
- **PHASE3_COMPLETE.md** - Auto-detection implementation

---

## Summary

**The TrinityCore MCP Server now automatically detects your client type and selects the optimal tool profile, reducing token usage by up to 91% while maintaining full backward compatibility.**

**No configuration required - just start the server and it works!**

---

**Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
