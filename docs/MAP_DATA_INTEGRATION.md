# TrinityCore Map Data Integration Guide

This guide explains how to extract and integrate WoW map data into the Map Coordinate Picker tool.

## Table of Contents

1. [Understanding WoW Coordinate Systems](#understanding-wow-coordinate-systems)
2. [Extracting Map Data with TrinityCore](#extracting-map-data-with-trinitycore)
3. [Getting Map Images](#getting-map-images)
4. [Integrating Maps into WebUI](#integrating-maps-into-webui)
5. [Working with Coordinates](#working-with-coordinates)

---

## Understanding WoW Coordinate Systems

WoW uses multiple coordinate systems that you need to understand:

### 1. World Coordinates (TrinityCore Internal)

- **Range**: `-17066.66` to `+17066.66` (total span: 34,133.32 yards)
- **Origin**: Center of the map (0, 0)
- **Axes**:
  - **X**: North (positive) / South (negative)
  - **Y**: West (positive) / East (negative)
  - **Z**: Height (0 = sea level, positive = above, negative = below)
- **Map Structure**: 64×64 ADT tiles, each tile = 533.33 yards

```
      North (+X)
           ↑
           |
West (+Y) ←+→ East (-Y)
           |
           ↓
      South (-X)
```

### 2. Zone Coordinates (In-Game UI)

- **Range**: `0` to `100` (percentage-based)
- **Origin**: Top-left corner (0, 0)
- **Bottom-right**: (100, 100)
- **Usage**: What players see with coordinate addons

### 3. ADT Tile Coordinates

- **Range**: `0` to `63` (64 tiles per axis)
- **Usage**: Map file organization in WoW client
- **File naming**: `world\maps\[MapName]\[MapName]_XX_YY.adt`

---

## Extracting Map Data with TrinityCore

### Step 1: Get TrinityCore Extractors

```bash
# Clone TrinityCore repository
git clone https://github.com/TrinityCore/TrinityCore.git
cd TrinityCore

# Build the extractors (Windows example)
cd contrib
```

For pre-built extractors, download from TrinityCore releases or build from source.

### Step 2: Extract Map Data

Place the extractors in your WoW client directory and run:

```bash
# On Windows
extractor.bat

# On Linux/macOS
./mapextractor
./vmap4extractor
./vmap4assembler
./mmaps_generator  # Optional, very slow
```

**What gets extracted:**

1. **DBC/DB2 Files** (`dbc/` or `db2/`)
   - `Map.dbc`: Map metadata (IDs, names, coordinate ranges)
   - `WorldMapArea.dbc`: Zone boundaries and UI mapping
   - `AreaTable.dbc`: Area names and zone information
   - `TaxiNodes.dbc`: Flight path locations
   - `TaxiPath.dbc`: Flight path connections

2. **Maps** (`maps/`)
   - `.map` files: Height map data (64×64 grid per continent)
   - Format: Binary files, 256×256 float height values per tile

3. **VMaps** (`vmaps/`)
   - `.vmap` files: Visual/collision geometry
   - Used for line-of-sight calculations

4. **MMaps** (`mmaps/`)
   - `.mmap` files: Navigation meshes for pathfinding
   - Used by creature AI for movement

### Step 3: Parse DBC Files

Use a DBC reader to extract useful data:

```bash
# Install a DBC parser (Python example)
pip install pydbc

# Or use online tools:
# - https://wowdev.wiki/DBC
# - WoW.tools (https://wow.tools/dbc/)
```

**Example: Extract Map Metadata**

```python
import dbc

# Read Map.dbc
with open('dbc/Map.dbc', 'rb') as f:
    maps = dbc.parse(f)

for map_entry in maps:
    print(f"ID: {map_entry['ID']}")
    print(f"Name: {map_entry['MapName_enUS']}")
    print(f"Directory: {map_entry['Directory']}")
```

---

## Getting Map Images

You have several options for obtaining map images:

### Option 1: Community-Made Maps (Recommended)

**High-resolution terrain maps** are available from the community:

1. **Reddit u/Sturmbart's Atlas** (13000×12000px)
   - Eastern Kingdoms: [Link](https://www.reddit.com/r/classicwow/comments/bcf5av/)
   - Kalimdor: Same thread
   - Features: Satellite effect, elevation shading, labeled locations

2. **Wowhead/Wowpedia Map Exports**
   - Available in various resolutions
   - Usually 2048×2048 or 4096×4096px

3. **WoW.tools Map Viewer**
   - https://wow.tools/maps/
   - Export maps as PNG with custom rendering

### Option 2: Extract from WoW Client

Use **WoW Model Viewer** or **Noggit** to render maps:

```bash
# Using WoW Model Viewer
# 1. Open map in WMV
# 2. Position camera overhead (top-down view)
# 3. Disable models/creatures (show only terrain)
# 4. Screenshot or export
```

### Option 3: Stitch Minimap Tiles

WoW stores minimap images as tiles in `World\Minimaps\[MapName]\`:

```python
# Python script to stitch minimap tiles
from PIL import Image
import os

def stitch_minimap(map_name, output_size=(4096, 4096)):
    # Minimap tiles are 256x256, arranged in 64x64 grid
    result = Image.new('RGB', output_size)

    for x in range(64):
        for y in range(64):
            tile_path = f"World/Minimaps/{map_name}/map{x}_{y}.blp"
            if os.path.exists(tile_path):
                # Convert BLP to PNG (use BLP library)
                tile = Image.open(tile_path)
                result.paste(tile, (x * 64, y * 64))

    result.save(f"{map_name}_fullmap.png")
```

---

## Integrating Maps into WebUI

### Step 1: Prepare Map Images

1. **Recommended format**: JPEG or PNG
2. **Recommended size**: 2048×2048 to 8192×8192px
3. **File naming**: `[map_name]_[mapid].jpg`

```bash
# Example structure
web-ui/public/maps/
  ├── eastern_kingdoms_0.jpg      # 4096×4096
  ├── kalimdor_1.jpg               # 4096×4096
  ├── outland_530.jpg              # 4096×4096
  └── northrend_571.jpg            # 4096×4096
```

### Step 2: Update Map Registry

Edit `web-ui/lib/map-editor.ts`:

```typescript
export const WoWMaps = {
  EASTERN_KINGDOMS: {
    id: 0,
    name: 'Eastern Kingdoms',
    expansion: 'classic',
    coordRange: {
      minX: -17066.66,
      maxX: 17066.66,
      minY: -17066.66,
      maxY: 17066.66
    },
    imageUrl: '/maps/eastern_kingdoms_0.jpg',
    hasImage: true,  // ← Set to true when image is available
  },
  // ... other maps
};
```

### Step 3: Use Map Images in Map Picker

The Map Picker (`web-ui/app/map-picker/page.tsx`) already supports loading images:

```typescript
import { loadMapImage, wowToCanvas, canvasToWow } from '@/lib/map-editor';

// In your component
const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
const [currentMapId, setCurrentMapId] = useState(0);

useEffect(() => {
  loadMapImage(currentMapId).then(setMapImage);
}, [currentMapId]);

// In draw() function
const draw = () => {
  const ctx = canvas.getContext('2d');

  // Draw map image if available
  if (mapImage) {
    ctx.drawImage(mapImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    // Fallback: draw grid background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Continue with drawing roads, spawns, etc.
};
```

---

## Working with Coordinates

### Converting Between Systems

The `map-editor.ts` library provides all necessary conversion functions:

```typescript
import {
  wowToCanvas,
  canvasToWow,
  zoneToWorld,
  worldToZone,
  WOW_COORD_CONSTANTS
} from '@/lib/map-editor';

// Example 1: Place a spawn at WoW coordinates (-8800, -200) on Eastern Kingdoms
const wowCoords = { x: -8800, y: -200 };
const canvasPos = wowToCanvas(
  wowCoords.x,
  wowCoords.y,
  0,  // Map ID (Eastern Kingdoms)
  2048,  // Canvas width
  2048   // Canvas height
);
console.log(`Draw at canvas position: ${canvasPos.x}, ${canvasPos.y}`);

// Example 2: User clicked canvas at (500, 800), get WoW coordinates
const clickPos = { x: 500, y: 800 };
const worldCoords = canvasToWow(
  clickPos.x,
  clickPos.y,
  0,  // Map ID
  2048,  // Canvas width
  2048   // Canvas height
);
console.log(`WoW coordinates: ${worldCoords.x}, ${worldCoords.y}`);

// Example 3: Convert zone coords (50, 50 = center) to world coords
// Assuming Elwynn Forest zone bounds
const zoneCoords = zoneToWorld(
  50,     // Zone X (50%)
  50,     // Zone Y (50%)
  -9500,  // Zone min X
  -8900,  // Zone max X
  -1000,  // Zone min Y
  -400    // Zone max Y
);
console.log(`World coordinates: ${zoneCoords.x}, ${zoneCoords.y}`);
```

### Example: Importing Spawn Data from Database

```typescript
// Fetch spawns from TrinityCore database
const spawns = await fetch('/api/creatures/spawns?map=0').then(r => r.json());

// Convert and display on canvas
spawns.forEach(spawn => {
  const canvasPos = wowToCanvas(
    spawn.position_x,
    spawn.position_y,
    spawn.map,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );

  // Draw spawn marker
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(canvasPos.x, canvasPos.y, 5, 0, Math.PI * 2);
  ctx.fill();
});
```

---

## Advanced: Parsing DBC Files in TypeScript

For full integration, parse DBC files directly:

```typescript
// Example: Parse Map.dbc to populate WoWMaps registry
interface DBCMapEntry {
  ID: number;
  Directory: string;
  InstanceType: number;
  Flags: number;
  MapName: string;
  MinimapIconScale: number;
  CorpseX: number;
  CorpseY: number;
  // ... other fields
}

async function loadMapDatabase(): Promise<DBCMapEntry[]> {
  // Use a DBC parser library or manual binary parsing
  const response = await fetch('/data/dbc/Map.dbc');
  const buffer = await response.arrayBuffer();

  // Parse DBC format (4-byte magic, row count, field count, record size, string block)
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true); // 'WDBC'
  const recordCount = view.getUint32(4, true);
  const fieldCount = view.getUint32(8, true);
  const recordSize = view.getUint32(12, true);
  const stringBlockSize = view.getUint32(16, true);

  // Parse records...
  // (Full implementation requires understanding DBC structure per file)

  return [];
}
```

---

## Complete Workflow Example

Here's a complete workflow from extraction to display:

### 1. Extract Data

```bash
cd "C:\Program Files (x86)\World of Warcraft\_classic_"
extractor.bat
# Select option 1: Extract base files
```

### 2. Get Map Image

Download Sturmbart's Eastern Kingdoms map or export from WoW.tools.

### 3. Prepare Files

```bash
# Copy to project
cp eastern_kingdoms.jpg /trinitycore-mcp/web-ui/public/maps/

# Copy DBC files (optional)
cp dbc/Map.dbc /trinitycore-mcp/data/dbc/
```

### 4. Update Code

```typescript
// web-ui/lib/map-editor.ts
export const WoWMaps = {
  EASTERN_KINGDOMS: {
    // ...
    imageUrl: '/maps/eastern_kingdoms.jpg',
    hasImage: true,  // ← Enable image
  },
};
```

### 5. Test in Browser

```bash
cd web-ui
npm run dev
# Navigate to http://localhost:3000/map-picker
# Select "Eastern Kingdoms" from map dropdown
# Map image should display with coordinate overlay
```

---

## Troubleshooting

### Map Image Not Loading

1. **Check file path**: Ensure image is in `web-ui/public/maps/`
2. **Check console**: Look for 404 errors
3. **Verify format**: Use JPEG or PNG (not BLP)
4. **Check size**: Very large images (>16k×16k) may fail to load

### Coordinate Misalignment

1. **Verify map ID**: Ensure using correct map ID for coordinate range
2. **Check coordinate source**: World coords vs zone coords vs ADT coords
3. **Test with known locations**: Use major cities with documented coordinates

### Performance Issues

1. **Optimize image size**: 4096×4096 is usually sufficient
2. **Use JPEG for photos**: Better compression than PNG for terrain
3. **Enable canvas caching**: Cache static elements off-screen

---

## Resources

- **TrinityCore GitHub**: https://github.com/TrinityCore/TrinityCore
- **WowDev Wiki**: https://wowdev.wiki/
- **WoW.tools**: https://wow.tools/
- **Map coordinates**: https://wowpedia.fandom.com/wiki/Map_coordinates
- **DBC File Formats**: https://wowdev.wiki/DBC

---

## API Reference

See `web-ui/lib/map-editor.ts` for full API documentation:

- `wowToCanvas()` - Convert WoW world coords to canvas pixels
- `canvasToWow()` - Convert canvas pixels to WoW world coords
- `zoneToWorld()` - Convert zone UI coords (0-100) to world coords
- `worldToZone()` - Convert world coords to zone UI coords
- `loadMapImage()` - Load map image for rendering
- `WOW_COORD_CONSTANTS` - Coordinate system constants
- `WoWMaps` - Map metadata registry
