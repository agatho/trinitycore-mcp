# SAI Editor User Guide

Complete guide to using the TrinityCore Smart AI (SAI) Unified Editor.

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Interface Overview](#interface-overview)
4. [Creating Scripts](#creating-scripts)
5. [Node Types](#node-types)
6. [Parameters](#parameters)
7. [Validation](#validation)
8. [Templates](#templates)
9. [AI Generation](#ai-generation)
10. [Collaboration](#collaboration)
11. [Import/Export](#importexport)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Best Practices](#best-practices)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

The SAI Editor is a professional visual editor for creating and managing TrinityCore Smart AI scripts. It provides:

- **Visual Node Editor**: Drag-and-drop interface with ReactFlow
- **Real-time Validation**: Instant feedback with database verification
- **AI-Powered Generation**: Generate scripts from natural language
- **Template Library**: 12+ pre-built templates
- **Collaborative Editing**: Work with multiple users in real-time
- **Complete SAI Support**: All 91 events, 160 actions, and 31 targets

---

## Getting Started

### Accessing the Editor

1. Navigate to `/sai-editor-pro` in your browser
2. Click "New Script" or select an existing script
3. Enter basic information:
   - **Creature Entry**: The creature ID
   - **Source Type**: Usually 0 for creature
   - **Script Name**: Descriptive name

### First Script

Let's create a simple "Talk on Aggro" script:

1. Click **Add Node** → **Event** → Select "Aggro"
2. Click **Add Node** → **Action** → Select "Talk"
3. Drag from the Event node's handle to the Action node
4. Click the Action node to edit parameters:
   - Set Text ID (e.g., 0 for broadcast text)
5. Click **Validate** to check for errors
6. Click **Export SQL** to generate the script

---

## Interface Overview

### Main Canvas

The center area where you build your script visually:

- **Zoom**: Mouse wheel or pinch gestures
- **Pan**: Click and drag on empty space
- **Select**: Click on nodes or connections
- **Multi-select**: Ctrl/Cmd + Click or drag selection box

### Toolbar (Top)

Primary actions:

- **Add Node**: Create Event, Action, or Target nodes
- **Undo/Redo**: Navigate edit history (50 states)
- **Copy/Cut/Paste**: Duplicate or move nodes
- **Layout**: Auto-arrange nodes (Layered, Hierarchical, Force)
- **Import/Export**: Load or save scripts
- **Validate**: Run full validation
- **Run Tests**: Execute test validation

### Right Sidebar

Four tabs:

1. **Properties**: Edit selected node parameters
2. **Validation**: View errors, warnings, and suggestions
3. **Templates**: Browse and apply pre-built scripts
4. **AI**: Generate scripts using AI

### Minimap

Bottom-right navigation aid showing the entire canvas with viewport indicator.

---

## Creating Scripts

### Adding Nodes

#### Event Nodes (Blue)

Trigger conditions for the script:

```
Add Node → Event → Select event type
```

**Common Events**:
- **Update IC**: Fires every X milliseconds
- **Aggro**: When creature enters combat
- **Evade**: When creature leaves combat
- **Killed Unit**: When creature kills something
- **Death**: When creature dies
- **Damaged**: When creature takes damage
- **Spell Hit**: When creature is hit by spell
- **Just Summoned**: When summoned by another creature

#### Action Nodes (Green)

What the creature does when event triggers:

```
Add Node → Action → Select action type
```

**Common Actions**:
- **Talk**: Say text from broadcast_text
- **Cast**: Cast a spell
- **Summon Creature**: Spawn another creature
- **Set Phase**: Change AI phase
- **Flee**: Run away
- **Set Data**: Send data to instance script
- **Set Health Regeneration**: Enable/disable health regen
- **Kill Self**: Creature dies

#### Target Nodes (Purple)

Who the action affects:

```
Add Node → Target → Select target type
```

**Common Targets**:
- **Self**: The creature itself
- **Victim**: Current target
- **Invoker**: Who triggered the event
- **Stored**: Previously stored target
- **Player Range**: Players within range
- **Creature Range**: Creatures within range

### Connecting Nodes

1. **Hover** over a node's connection handle (right side)
2. **Click and drag** to another node
3. **Release** to create connection

**Connection Types**:
- **Event → Action**: Actions triggered by this event
- **Action → Target**: Targets for this action
- **Event → Event**: Chained events (advanced)

---

## Node Types

### Events (91 Types)

#### Combat Events

| Event | ID | Description |
|-------|------|-------------|
| Update IC | 0 | Fires periodically in combat |
| Aggro | 4 | Enters combat |
| Kill | 5 | Kills a unit |
| Death | 6 | Creature dies |
| Evade | 7 | Leaves combat |
| Spell Hit | 8 | Hit by specific spell |
| Range | 9 | Target in/out of range |
| Health PCT | 2 | Health below percentage |
| Mana PCT | 3 | Mana below percentage |
| Damaged | 12 | Takes damage |

#### Scripted Events

| Event | ID | Description |
|-------|------|-------------|
| Update OOC | 1 | Fires periodically out of combat |
| Summoned Unit | 10 | Creature is summoned |
| Just Summoned | 54 | Just summoned a creature |
| Link | 11 | Linked creature evoked |
| Data Set | 38 | Receives data from script |
| Waypoint Reached | 40 | Reaches waypoint |
| Text Over | 52 | Text speech finishes |
| Distance | 75 | Within distance of creature/GO |

### Actions (160 Types)

#### Communication Actions

| Action | ID | Description |
|--------|------|-------------|
| Talk | 1 | Say text |
| Set Faction | 2 | Change faction |
| Emote | 11 | Play emote |
| Sound | 51 | Play sound |
| Random Emote | 91 | Random emote from list |

#### Combat Actions

| Action | ID | Description |
|--------|------|-------------|
| Cast | 11 | Cast spell |
| Threat All PCT | 3 | Modify threat percentage |
| Threat Single PCT | 4 | Modify threat on target |
| Call For Help | 39 | Alert nearby creatures |
| Set Combat Movement | 60 | Enable/disable movement |
| Set Melee Attack | 76 | Enable/disable melee |

#### Summoning Actions

| Action | ID | Description |
|--------|------|-------------|
| Summon Creature | 12 | Spawn creature |
| Summon GO | 70 | Spawn game object |
| Kill Unit | 37 | Kill target |

#### State Actions

| Action | ID | Description |
|--------|------|-------------|
| Set Phase | 22 | Change AI phase |
| Set Event Phase | 67 | Set event phase mask |
| Inc Event Phase | 68 | Increment phase |
| Set Health Regen | 57 | Toggle health regeneration |
| Set React State | 21 | Set reaction state |
| Set Active | 61 | Set active object |

### Targets (31 Types)

| Target | ID | Description |
|--------|------|-------------|
| Self | 0 | The creature itself |
| Victim | 1 | Current target |
| Hostile Random | 2 | Random hostile player |
| Hostile Random Not Top | 3 | Random hostile not top threat |
| Action Invoker | 7 | Who triggered event |
| Stored | 10 | Previously stored target |
| Player Range | 16 | Players within range |
| Creature Range | 17 | Creatures within range |
| Closest Creature | 19 | Nearest creature by entry |
| Closest Player | 21 | Nearest player |

---

## Parameters

Each node type has specific parameters. The editor provides:

- **Type-aware inputs**: Numbers, dropdowns, checkboxes
- **Validation**: Real-time error checking
- **Tooltips**: Hover for parameter description
- **Database lookup**: IDs verified against TrinityCore database

### Common Parameter Types

#### Integer Values

```
Min Value: 0
Max Value: 2147483647
Step: 1
```

#### Flags (Bitwise)

```
Checkbox list for each flag
Example: Event Flags, Target Flags
```

#### Enumerations

```
Dropdown with predefined values
Example: Spell Cast Flags, Summon Types
```

#### IDs (Database References)

```
Validates against database
Examples:
- Spell ID → spell_template
- Item ID → item_template
- Quest ID → quest_template
- Creature ID → creature_template
```

### Event Parameters

**Update IC (Event 0)**:
- `InitialMin`: Minimum time before first trigger (ms)
- `InitialMax`: Maximum time before first trigger (ms)
- `RepeatMin`: Minimum repeat interval (ms)
- `RepeatMax`: Maximum repeat interval (ms)

**Health PCT (Event 2)**:
- `MinHP`: Minimum health percentage
- `MaxHP`: Maximum health percentage
- `RepeatMin`: Minimum repeat interval (ms)
- `RepeatMax`: Maximum repeat interval (ms)

**Aggro (Event 4)**:
- No parameters

### Action Parameters

**Talk (Action 1)**:
- `TextGroupID`: Text ID from broadcast_text
- `Duration`: Text duration (ms), 0 = default
- `UseTalkTarget`: 0 = self, 1 = target

**Cast (Action 11)**:
- `SpellID`: Spell ID to cast
- `CastFlags`: How to cast (triggered, interrupt, etc.)
- `TriggeredFlags`: Spell triggered flags

**Summon Creature (Action 12)**:
- `CreatureID`: Creature entry to summon
- `SummonType`: Summon behavior type
- `Duration`: How long summon lasts (ms)
- `StorageID`: ID to store summon reference
- `AttackInvoker`: 0/1 attack who triggered event

---

## Validation

The editor provides three levels of validation:

### Errors (Red) - Must Fix

Block script from working:

- Missing required parameters
- Invalid database IDs (spell, item, creature, quest, GO)
- Orphaned nodes (not connected)
- Circular dependencies
- Invalid connection types

### Warnings (Yellow) - Should Fix

May cause issues:

- Parameters outside typical range
- Inefficient patterns
- Deprecated event/action types
- Missing targets for actions
- Overly complex scripts (100+ nodes)

### Info (Blue) - Suggestions

Optimization tips:

- Consider using templates
- Alternative approaches
- Performance improvements
- Best practice recommendations

### Real-time Database Validation

IDs are automatically validated against the TrinityCore database:

```
✓ Spell 12345 exists: "Fireball"
✗ Spell 99999 not found in database
✓ Creature 1234 exists: "Training Dummy"
```

**Caching**: Results cached for performance
- Client: 5 minutes
- Server: 1 hour

### Validation Score

Scripts receive a score 0-100:

- **90-100**: Excellent - No issues
- **70-89**: Good - Minor warnings
- **50-69**: Fair - Some issues
- **0-49**: Poor - Major problems

---

## Templates

12+ pre-built templates for common scenarios:

### Combat Templates

1. **Basic Melee Fighter**
   - Aggro event
   - Melee attacks
   - Simple combat

2. **Caster Boss**
   - Multiple spell casts
   - Health-based phases
   - Summon adds at thresholds

3. **Tank and Spank**
   - Single target focus
   - Enrage timer
   - Simple mechanics

### Advanced Templates

4. **Multi-Phase Boss**
   - 3+ distinct phases
   - Phase transitions
   - Add spawns per phase

5. **Patrol Guard**
   - Waypoint movement
   - Call for help on aggro
   - Return to patrol

6. **Questgiver NPC**
   - Gossip handling
   - Quest completion checks
   - Reward distribution

### Using Templates

1. Open **Templates** tab
2. Browse or search templates
3. Click template to view details
4. Configure placeholder values (IDs, timers, etc.)
5. Click **Apply Template**
6. Customize as needed

---

## AI Generation

Generate scripts from natural language descriptions using AI.

### Supported AI Providers

1. **OpenAI GPT-4** (Cloud, API key)
2. **Claude/Anthropic** (Cloud, API key or Claude Code Max)
3. **Ollama** (Local, free)
4. **LM Studio** (Local, free)

### Setup

#### Method 1: Claude Code Max (Recommended)

If you have Claude Code with Max subscription:

1. Go to **AI** tab → **Settings**
2. Select **Claude** provider
3. Check **"I have Claude Code with Max subscription"**
4. Optionally add API key as fallback
5. Select model: Claude 3 Opus
6. Click **Save Config**

#### Method 2: API Key (Cloud Providers)

For OpenAI or Claude with your own API key:

1. Get API key:
   - OpenAI: https://platform.openai.com/api-keys
   - Claude: https://console.anthropic.com/

2. Go to **AI** tab → **Settings**
3. Select provider (OpenAI or Claude)
4. Enter API key
5. Select model
6. Click **Save Config**

#### Method 3: Local LLMs (Free)

For Ollama or LM Studio:

1. Install provider:
   - Ollama: https://ollama.ai/
   - LM Studio: https://lmstudio.ai/

2. Start local server:
   ```bash
   # Ollama
   ollama serve
   ollama pull mistral

   # LM Studio
   # Start server in GUI (default: http://localhost:1234)
   ```

3. Go to **AI** tab → **Settings**
4. Select provider (Ollama or LM Studio)
5. Enter API URL (default: http://localhost:11434 or :1234)
6. Select model
7. Click **Save Config**

### Generating Scripts

1. Go to **AI** tab → **Generate**
2. Enter description:

```
A fire mage boss that:
- Casts Fireball every 3-5 seconds
- Summons 2 Fire Elementals at 75%, 50%, and 25% health
- Casts Flame Shield at 50% health
- Enrages at 10% health
```

3. (Optional) Add context:
   - Creature Entry: 12345
   - Creature Type: Humanoid
   - Creature Rank: Elite
   - Level: 60

4. Click **Generate**
5. Review generated script
6. Click **Apply to Editor**
7. Customize as needed

### Example Prompts

**Simple**:
```
Boss that casts frost bolt and summons adds
```

**Detailed**:
```
A healing boss encounter:
- Phase 1 (100-60%): Heals self every 10 seconds
- Phase 2 (60-30%): Summons 3 healing adds
- Phase 3 (30-0%): Enrages, faster heals
- Dies when adds are killed
```

**With Mechanics**:
```
Patrol guard that:
- Walks predefined waypoints
- Calls for help when attacked
- Flees at 20% health
- Returns to patrol when out of combat
```

---

## Collaboration

Work with multiple users simultaneously in real-time.

### Prerequisites

Collaboration requires the custom WebSocket server:

```bash
cd web-ui
node server.js
```

See [COLLABORATION_SETUP.md](./COLLABORATION_SETUP.md) for full setup guide.

### Features

#### Presence Awareness

See who else is editing:
- User avatars in top-right
- Online status indicators
- User count badge

#### Cursor Sharing

See where others are working:
- Colored cursors for each user
- Username labels
- Real-time movement

#### Selection Sharing

See what nodes others have selected:
- Colored outlines around selected nodes
- Selection indicators

#### Node Locking

Prevent simultaneous edits:
- Nodes lock automatically when editing
- Locked nodes show lock icon
- Locked by user name displayed

#### Change Broadcasting

All changes propagate instantly:
- Node additions/deletions
- Parameter updates
- Connection changes
- Layout updates

### Usage

1. **Connect**: Open same script URL in multiple browsers/tabs
2. **Collaborate**: Make changes - others see them instantly
3. **Lock nodes**: Click to edit - node locks for you
4. **Unlock**: Save or click away - node unlocks

### Troubleshooting

**"Not connected" status**:
- Check server is running: `node server.js`
- Check WebSocket URL in browser console
- Verify firewall allows WebSocket connections

**Changes not appearing**:
- Check network connectivity
- Verify same script ID
- Check browser console for errors

---

## Import/Export

### Export SQL

Generate TrinityCore-compatible SQL:

1. Click **Export SQL** in toolbar
2. Choose format:
   - **Full**: Complete script
   - **Insert only**: Only INSERT statements
   - **Update only**: Only UPDATE statements

3. Copy SQL or download file
4. Execute in database:

```sql
DELETE FROM `smart_scripts` WHERE `entryorguid` = 12345 AND `source_type` = 0;
INSERT INTO `smart_scripts` (...) VALUES (...);
```

### Import SQL

Load existing scripts:

1. Click **Import** in toolbar
2. Paste SQL or upload file
3. Editor parses and displays script
4. Click **Apply** to load

**Supported formats**:
- TrinityCore smart_scripts
- Both old and new formats
- Comments preserved

### Export JSON

Save in portable format:

```json
{
  "id": "script-123",
  "name": "Fire Mage Boss",
  "entryOrGuid": 12345,
  "sourceType": 0,
  "nodes": [...],
  "connections": [...],
  "metadata": {
    "version": "3.0.0",
    "createdAt": 1234567890,
    "modifiedAt": 1234567890
  }
}
```

### Import JSON

Load from JSON:

1. Click **Import** → **JSON**
2. Paste JSON or upload file
3. Editor validates and loads
4. Click **Apply**

---

## Keyboard Shortcuts

### Navigation

| Shortcut | Action |
|----------|--------|
| `Mouse Wheel` | Zoom in/out |
| `Space + Drag` | Pan canvas |
| `F` | Fit to view |
| `+` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |

### Editing

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected |
| `Ctrl/Cmd + X` | Cut selected |
| `Ctrl/Cmd + V` | Paste |
| `Delete` | Delete selected |
| `Ctrl/Cmd + A` | Select all |
| `Escape` | Deselect all |

### Nodes

| Shortcut | Action |
|----------|--------|
| `E` | Add Event node |
| `A` | Add Action node |
| `T` | Add Target node |
| `D` | Duplicate selected |
| `G` | Group selected |

### Tools

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save script |
| `Ctrl/Cmd + E` | Export SQL |
| `Ctrl/Cmd + I` | Import |
| `Ctrl/Cmd + V` | Validate |
| `Ctrl/Cmd + L` | Auto-layout |

---

## Best Practices

### Script Organization

1. **Use descriptive names**:
   ```
   ✓ "Fire Mage Boss - Ragnaros Junior"
   ✗ "Script123"
   ```

2. **Group related events**:
   - Combat events together
   - Out-of-combat events together
   - Scripted events separately

3. **Use phases for complex scripts**:
   ```
   Phase 1: 100-75% health
   Phase 2: 75-50% health
   Phase 3: 50-25% health
   Phase 4: 25-0% health (enrage)
   ```

4. **Comment complex logic**:
   - Add Comment nodes for clarity
   - Explain unusual mechanics
   - Document required database entries

### Performance

1. **Minimize Update IC events**:
   ```
   ✓ RepeatMin: 5000, RepeatMax: 10000
   ✗ RepeatMin: 100, RepeatMax: 200
   ```

2. **Use appropriate ranges**:
   ```
   ✓ Range: 0-40 yards (reasonable)
   ✗ Range: 0-1000 yards (entire zone)
   ```

3. **Avoid excessive summons**:
   ```
   ✓ Summon 2-3 adds per phase
   ✗ Summon 50 adds repeatedly
   ```

4. **Cache target references**:
   - Store frequently used targets
   - Reuse stored targets
   - Clear storage when done

### Testing

1. **Test all phases**:
   - Verify health thresholds
   - Check phase transitions
   - Confirm spell casts

2. **Test edge cases**:
   - What if target dies?
   - What if player leaves range?
   - What if spell is resisted?

3. **Test with validators**:
   - Run full validation
   - Fix all errors
   - Address warnings
   - Review suggestions

4. **Test in-game**:
   - Spawn creature
   - Trigger events
   - Verify behavior
   - Check combat log

---

## Troubleshooting

### Common Issues

#### Validation Errors

**"Missing required parameter"**:
- Solution: Fill in all required fields (marked with *)

**"Invalid spell ID"**:
- Solution: Verify spell exists in spell_template
- Use database lookup to find correct ID

**"Orphaned node"**:
- Solution: Connect node or delete it

#### Script Not Working

**Events not triggering**:
- Check event parameters (timing, range, conditions)
- Verify event flags are correct
- Check phase masks

**Actions not executing**:
- Verify actions are connected to events
- Check action parameters (spell ID, target, etc.)
- Review cast flags for spells

**Targets not working**:
- Verify target type matches action
- Check target range/distance
- Confirm target exists and is valid

#### AI Generation Issues

**"Connection failed"**:
- Check API key is valid
- Verify API URL is correct
- Check internet connection
- Verify backend server is running (for Claude Code Max)

**Generated script has errors**:
- AI is not perfect - always review generated scripts
- Validate before using
- Fix parameters as needed
- Adjust prompt for better results

#### Collaboration Issues

**"Not connected"**:
- Verify WebSocket server is running
- Check firewall settings
- Confirm port 3000 is accessible

**Changes not syncing**:
- Check network connection
- Verify same script ID
- Refresh page and reconnect

### Getting Help

1. **Check documentation**:
   - This guide
   - [API Documentation](./API.md)
   - [Testing Guide](./TESTING_GUIDE.md)
   - [Collaboration Setup](./COLLABORATION_SETUP.md)

2. **Run validation**:
   - Click Validate button
   - Review all errors/warnings
   - Follow suggestions

3. **Check console**:
   - Open browser DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed requests

4. **Report issues**:
   - Include script JSON
   - Describe expected vs actual behavior
   - Attach screenshots
   - Include browser console errors

---

## Appendix

### SAI Event Types Reference

See [TrinityCore Documentation](https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130108/smart+scripts) for complete event type reference.

### SAI Action Types Reference

See [TrinityCore Documentation](https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130108/smart+scripts) for complete action type reference.

### SAI Target Types Reference

See [TrinityCore Documentation](https://trinitycore.atlassian.net/wiki/spaces/tc/pages/2130108/smart+scripts) for complete target type reference.

---

## Version History

- **v3.0.0** (2024) - Unified editor with AI, collaboration, validation
- **v2.0.0** (2023) - Enhanced editor with templates
- **v1.0.0** (2022) - Initial visual editor

---

## License

This editor is part of the TrinityCore MCP project and follows the GPL-2.0 license.
