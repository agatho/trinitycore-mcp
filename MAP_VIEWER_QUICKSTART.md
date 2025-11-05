# TrinityCore Map Viewer - Quick Start Guide

## What is the Map Viewer?

The TrinityCore Map Viewer is a powerful tool for visualizing terrain data from TrinityCore's extracted `.map` files. It provides multiple rendering modes, color schemes, and interactive controls to explore World of Warcraft's terrain data.

## Quick Setup (5 minutes)

### Step 1: Extract Map Files

If you haven't already extracted map files from your WoW client:

```bash
# Navigate to your TrinityCore tools directory
cd /path/to/TrinityCore/bin

# Run the map extractor
./mapextractor

# This will create a 'maps' directory with .map files
# Each file is named MapID_X_Y.map (e.g., 0_32_32.map)
```

### Step 2: Configure Environment Variable

1. Navigate to the web-ui directory:
   ```bash
   cd /path/to/trinitycore-mcp/web-ui
   ```

2. Copy the template environment file:
   ```bash
   cp .env.template .env.local
   ```

3. Edit `.env.local` and add your map files path:
   ```bash
   # Linux/Mac example:
   MAP_FILES_PATH=/home/user/TrinityCore/data/maps

   # Windows example:
   MAP_FILES_PATH=C:/TrinityCore/data/maps
   ```

### Step 3: Start the Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start the dev server
npm run dev
```

### Step 4: Access the Map Viewer

1. Open your browser to: http://localhost:3000/map-viewer
2. Click the "Browser" tab (should be selected by default)
3. You should see a list of all available .map files
4. Click "Load" on any map file to visualize it

## Features Overview

### Render Modes

- **Heightmap**: Color-coded elevation (Green = low, Red = high)
- **Contours**: Topographic lines showing elevation
- **Wireframe**: 3D mesh grid view
- **Shaded Relief**: Hillshade with realistic lighting

### Color Schemes

- **Grayscale**: Simple elevation gradient
- **Elevation**: Green → Yellow → Red
- **Terrain**: Realistic water/land/mountain colors
- **Heatmap**: Blue → Cyan → Yellow → Red

### Controls

- **Scale**: Adjust rendering resolution (1x - 8x)
- **Contour Interval**: Change spacing between contour lines (5m - 50m)
- **Export PNG**: Save current view as an image
- **Reset View**: Return to default settings

## Troubleshooting

### "MAP_FILES_PATH not configured"

**Problem**: Environment variable not set or dev server not restarted.

**Solution**:
1. Verify `.env.local` contains `MAP_FILES_PATH=...`
2. Restart the dev server with `npm run dev`

### "MAP_FILES_PATH directory not found"

**Problem**: The path in `.env.local` doesn't exist.

**Solution**:
1. Check the path is correct: `ls /your/path/to/maps`
2. Ensure you've run `mapextractor` to generate .map files

### "No map files found"

**Problem**: The directory exists but contains no .map files.

**Solution**:
1. Run TrinityCore's mapextractor tool
2. Verify the output directory matches your MAP_FILES_PATH

### "Invalid map file magic"

**Problem**: File is corrupted or not a valid .map file.

**Solution**:
1. Re-extract the map files using mapextractor
2. Ensure files weren't modified or corrupted during transfer

## Map File Format

TrinityCore .map files contain:
- **Area Map**: Zone ID data for each coordinate
- **Height Map**: Terrain elevation data (V8: 128x128 or V9: 129x129)
- **Liquid Map**: Water, lava, and slime data
- **Holes**: Terrain cutouts and caves

Filename format: `MapID_X_Y.map`
- Map 0 = Eastern Kingdoms
- Map 1 = Kalimdor
- Map 530 = Outland
- Map 571 = Northrend

Example: `0_32_32.map` = Eastern Kingdoms, grid coordinates (32, 32)

## Advanced Usage

### Using the Parser Programmatically

```typescript
import { parseMapFile } from '@/lib/map-file-parser';

// Load and parse a map file
const response = await fetch('/api/map-files/0_32_32.map');
const arrayBuffer = await response.arrayBuffer();
const parsedMap = await parseMapFile('0_32_32.map', arrayBuffer);

// Access terrain data
console.log('Map ID:', parsedMap.mapId);
console.log('Grid:', parsedMap.gridX, parsedMap.gridY);
console.log('Height range:', parsedMap.heightMap.minHeight, '-', parsedMap.heightMap.maxHeight);
console.log('Grid size:', parsedMap.heightMap.gridWidth, 'x', parsedMap.heightMap.gridHeight);

// Access height at specific coordinate
const height = parsedMap.heightMap.data[y][x];
```

### Using the Renderer Programmatically

```typescript
import { MapRenderer } from '@/lib/map-renderer';

const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
const renderer = new MapRenderer(canvas);

await renderer.render(parsedMap, {
  mode: 'shaded',
  colorScheme: 'terrain',
  scale: 4,
  contourInterval: 10,
  showGrid: false,
});

// Export as PNG
renderer.exportToPNG('my_map.png');
```

## API Reference

### GET /api/map-files

Returns list of all available map files.

**Response**:
```json
{
  "success": true,
  "count": 150,
  "basePath": "/path/to/maps",
  "files": [...]
}
```

### GET /api/map-files/[filename]

Downloads a specific map file.

**Example**: `/api/map-files/0_32_32.map`

**Response**: Binary .map file data

## Performance Tips

1. **Start with Scale 2x**: Lower scales render faster
2. **Use Heightmap mode first**: Fastest rendering mode
3. **Increase scale gradually**: Only go higher if you need more detail
4. **Export before changing settings**: Save your work frequently

## Common Map IDs

- **0**: Eastern Kingdoms
- **1**: Kalimdor
- **530**: Outland (The Burning Crusade)
- **571**: Northrend (Wrath of the Lich King)
- **732**: The Maelstrom (Cataclysm)

Each map is divided into a grid of typically 64x64 tiles, so you'll have many files per map (e.g., 0_0_0.map through 0_63_63.map for Eastern Kingdoms).

## Next Steps

1. ✅ Set up MAP_FILES_PATH
2. ✅ Load your first map
3. Try different render modes
4. Experiment with color schemes
5. Export maps as PNG images
6. Explore different map regions
7. Use programmatic API for custom tools

## Support

For issues or questions:
- Check the full documentation: `ENHANCED_TOOLS_README.md`
- Review TrinityCore docs: https://trinitycore.info
- Open an issue on GitHub

## Version

Map Viewer v2.9.0 - Released January 2025
