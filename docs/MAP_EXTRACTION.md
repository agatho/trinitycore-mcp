# Map Extraction System

## Overview

The TrinityCore-MCP Map Extraction System provides automated extraction and tiling of World of Warcraft map textures from CASC (Content Addressable Storage Container) for use in the World Editor.

### Key Features

- ✅ **Direct CASC Reading** - Extracts maps from your local WoW installation
- ✅ **Multiple Quality Levels** - Supports low, medium, high, and all quality levels
- ✅ **Automatic Tiling** - Converts large maps into efficient 256x256 tiles
- ✅ **Viewport-Based Loading** - Only loads visible tiles + buffer (memory efficient)
- ✅ **Multi-Zoom Support** - Generates multiple zoom levels for smooth scaling
- ✅ **Legal Compliance** - No redistributed files, extraction from user's own WoW installation
- ✅ **BLP to PNG Conversion** - Converts Blizzard's BLP format to standard PNG/WebP

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WoW Retail Installation                   │
│         C:\Program Files\World of Warcraft\_retail_          │
│                                                               │
│  ├── Data/                                                    │
│  │   ├── data/      (CASC archive files)                     │
│  │   ├── indices/   (CASC index files)                       │
│  │   └── config/    (CASC configuration)                     │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                │ CASC Reader
                                ▼
┌─────────────────────────────────────────────────────────────┐
│               src/casc/CASCReader.ts                         │
│  • Reads CASC storage structure                              │
│  • Extracts map textures (BLP files)                         │
│  • Supports multiple quality levels                          │
│  • Auto-detection of WoW installation                        │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                │ BLP Files
                                ▼
┌─────────────────────────────────────────────────────────────┐
│             src/casc/BLPConverter.ts                         │
│  • Converts BLP to PNG                                        │
│  • Handles BLP0, BLP1, BLP2 formats                          │
│  • Supports uncompressed, DXT, JPEG compression              │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                │ PNG Files
                                ▼
┌─────────────────────────────────────────────────────────────┐
│               src/casc/MapTiler.ts                           │
│  • Tiles large maps into 256x256 chunks                      │
│  • Generates multiple zoom levels                            │
│  • Outputs WebP format (smaller size)                        │
│  • Creates metadata.json for each map                        │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                │ Tiled Maps
                                ▼
┌─────────────────────────────────────────────────────────────┐
│           web-ui/public/maps/tiles/{mapId}/                  │
│                                                               │
│  ├── 0/              (Zoom level 0 - full resolution)        │
│  │   ├── 0_0.webp                                            │
│  │   ├── 0_1.webp                                            │
│  │   └── ...                                                 │
│  ├── 1/              (Zoom level 1 - 50% scale)              │
│  ├── 2/              (Zoom level 2 - 25% scale)              │
│  └── metadata.json   (Tile metadata)                         │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                │ HTTP Request
                                ▼
┌─────────────────────────────────────────────────────────────┐
│     web-ui/components/map/TiledMapViewer.tsx                 │
│  • Viewport-based tile loading                               │
│  • Only loads visible + surrounding tiles                    │
│  • Zoom controls                                              │
│  • Click interaction                                          │
└─────────────────────────────────────────────────────────────┘
```

## Installation & Setup

### 1. Configure WoW Installation Path

Add to your `.env` file:

```bash
# Path to World of Warcraft Retail Installation
WOW_PATH=C:\Program Files (x86)\World of Warcraft\_retail_
```

Or for Mac:
```bash
WOW_PATH=/Applications/World of Warcraft/_retail_
```

**Auto-Detection**: Leave `WOW_PATH` empty to auto-detect common installation paths.

### 2. Install Dependencies

Dependencies are already included:
- `sharp` - Image processing (Next.js dependency)
- `pngjs` - PNG encoding/decoding

### 3. Verify Installation

The system will automatically check your WoW installation when you access the Map Extraction Panel.

## Usage

### Via Web UI

1. **Access World Editor**
   - Navigate to http://localhost:3000/world-editor
   - Open the "Map Extraction" panel

2. **Check WoW Installation**
   - Panel shows installation status
   - ✅ Green = Valid installation found
   - ❌ Red = No installation (configure WOW_PATH)

3. **Select Quality Level**
   - **All Qualities** (Recommended) - Extracts low, medium, high
   - **High Quality Only** - Best visuals, larger files
   - **Medium Quality Only** - Balanced
   - **Low Quality Only** - Fastest extraction, smaller files

4. **Extract Map**
   - Click "Extract" button for desired map
   - Progress bar shows extraction status
   - Extraction stages:
     1. Extracting from CASC (40%)
     2. Converting BLP to PNG (70%)
     3. Tiling maps (100%)

5. **View Extracted Maps**
   - Maps automatically appear in World Editor
   - Zoom controls available
   - Only visible tiles loaded (memory efficient)

### Via MCP Tools

```typescript
import { extractMapTextures } from './src/tools/mapextraction.js';

// Extract Eastern Kingdoms (Map ID 0)
const status = await extractMapTextures({
  mapId: 0,
  quality: 'all',
  enableTiling: true,
  tileSize: 256
});

console.log(status.status); // 'completed'
console.log(status.progress); // 100
console.log(status.metadata); // TileMetadata
```

### Via API Routes

```bash
# List available maps
GET /api/maps/list

# Get WoW installation info
GET /api/maps/wow-info

# Extract map
POST /api/maps/extract
{
  "mapId": 0,
  "quality": "all",
  "enableTiling": true,
  "tileSize": 256
}

# Delete extracted map
DELETE /api/maps/{mapId}
```

## Map IDs Reference

| Map ID | Name | Continent |
|--------|------|-----------|
| 0 | Eastern Kingdoms | Azeroth |
| 1 | Kalimdor | Azeroth |
| 530 | Outland | Outland |
| 571 | Northrend | Northrend |
| 860 | Pandaria | Pandaria |
| 870 | Draenor | Draenor |
| 1116 | Broken Isles | Broken Isles |
| 1220 | Kul Tiras | Kul Tiras |
| 1642 | Shadowlands | Shadowlands |
| 2444 | Dragon Isles | Dragon Isles |
| 2552 | The War Within | Khaz Algar |

## Performance & Optimization

### Memory Efficiency

The TiledMapViewer only loads tiles that are:
- Currently visible in the viewport
- Within the padding buffer (default: 2 tiles)

This means for a 600px viewport:
- Visible area: ~6 tiles (256px each)
- With padding: ~24 tiles loaded
- Total memory: ~6MB (vs 200+ MB for full map)

### Disk Space

Approximate sizes for extracted maps:

| Quality | Per Map | All Maps (11) |
|---------|---------|---------------|
| Low | 50-100 MB | 550-1100 MB |
| Medium | 100-200 MB | 1.1-2.2 GB |
| High | 200-400 MB | 2.2-4.4 GB |
| **All** | **350-700 MB** | **3.8-7.7 GB** |

**Recommendation**: Extract only the maps you need, or use "Medium" quality for balance.

### Extraction Time

Average extraction times (per map):

- **Extraction from CASC**: 30-60 seconds
- **BLP to PNG Conversion**: 10-20 seconds
- **Tiling**: 20-40 seconds
- **Total**: ~1-2 minutes per map

**Parallel Extraction**: Extract multiple maps simultaneously (UI supports this).

## File Structure

```
trinitycore-mcp/
├── data/
│   └── maps/
│       ├── extracted/          # Raw BLP files from CASC
│       │   └── {mapId}/
│       │       ├── map.blp
│       │       └── ...
│       └── converted/          # Converted PNG files
│           └── {mapId}/
│               ├── map.png
│               └── ...
│
└── web-ui/
    └── public/
        └── maps/
            └── tiles/          # Tiled maps (served via HTTP)
                └── {mapId}/
                    ├── 0/      # Zoom level 0 (full res)
                    │   ├── 0_0.webp
                    │   ├── 0_1.webp
                    │   └── ...
                    ├── 1/      # Zoom level 1 (50%)
                    ├── 2/      # Zoom level 2 (25%)
                    └── metadata.json
```

## Troubleshooting

### "WoW Installation Not Found"

**Cause**: WOW_PATH not set or invalid

**Solutions**:
1. Set WOW_PATH in `.env`:
   ```bash
   WOW_PATH=C:\Program Files (x86)\World of Warcraft\_retail_
   ```

2. Verify path is correct:
   - Should point to `_retail_` directory
   - Should contain `Data/data/` subdirectory

3. Check permissions:
   - Ensure read access to WoW installation

### "Invalid CASC Structure"

**Cause**: Not a retail WoW installation (e.g., Classic or PTR)

**Solution**: Point to `_retail_` directory, not `_classic_` or `_ptr_`

### "Map Textures Not Found"

**Cause**: Map ID doesn't exist or textures missing from CASC

**Solutions**:
1. Verify map ID is correct (see Map IDs Reference)
2. Ensure WoW client is up-to-date
3. Try different quality level

### "Tiles Not Loading in Viewer"

**Cause**: Extraction incomplete or files missing

**Solutions**:
1. Check extraction completed (status = 'completed')
2. Verify files exist in `web-ui/public/maps/tiles/{mapId}/`
3. Check browser console for 404 errors
4. Clear browser cache and reload

### "Out of Memory During Extraction"

**Cause**: Large map + insufficient RAM

**Solutions**:
1. Close other applications
2. Extract one map at a time
3. Use lower quality level
4. Increase Node.js memory:
   ```bash
   NODE_OPTIONS=--max_old_space_size=4096 npm run dev
   ```

## Legal & Compliance

### ⚠️ Important Legal Notice

Map textures are extracted from **your personal WoW installation** for development purposes only.

**Do NOT**:
- ❌ Redistribute extracted map files
- ❌ Share extracted textures publicly
- ❌ Include extracted files in git repositories
- ❌ Use for commercial purposes

**Do**:
- ✅ Extract from your own WoW installation
- ✅ Use for personal development
- ✅ Add extraction directories to `.gitignore`
- ✅ Respect Blizzard's intellectual property

### Files Added to .gitignore

```gitignore
# Map extraction output (do not commit)
data/maps/extracted/
data/maps/converted/
web-ui/public/maps/tiles/
```

## API Reference

### CASCReader

```typescript
class CASCReader {
  constructor(config: CASCConfig);
  async initialize(): Promise<void>;
  async extractMapTextures(mapId: number, quality: MapQuality): Promise<string[]>;
  static async isValidWoWPath(path: string): Promise<boolean>;
  static async detectWoWPath(): Promise<string | null>;
}
```

### BLPConverter

```typescript
class BLPConverter {
  static async convertToPNG(blpPath: string, pngPath: string): Promise<void>;
  static async convertBatch(blpFiles: string[], outputDir: string): Promise<string[]>;
}
```

### MapTiler

```typescript
class MapTiler {
  constructor(options: TilingOptions);
  async tileImage(inputPath: string, outputDir: string): Promise<TileMetadata>;
  static getViewportTiles(metadata: TileMetadata, viewport: Viewport): TileCoord[];
}
```

## Future Enhancements

Potential improvements for future versions:

1. **CDN Fallback** - Download from Blizzard CDN if local files missing
2. **Full CASC Parsing** - Complete root file and encoding table parsing
3. **DXT Decompression** - Native DXT1/3/5 texture decompression
4. **Progressive Loading** - Load lower quality first, then upgrade
5. **Caching Layer** - Cache frequently accessed tiles in memory
6. **Batch Extraction** - Extract all maps with one click
7. **Incremental Updates** - Only re-extract changed tiles

## Contributing

To improve the map extraction system:

1. **Report Issues**: https://github.com/agatho/trinitycore-mcp/issues
2. **Submit PRs**: Improvements to CASC reading, BLP conversion, or tiling
3. **Test**: Different WoW versions, platforms, and map IDs

## References

- **CASC Format**: https://wowdev.wiki/CASC
- **BLP Format**: https://wowdev.wiki/BLP
- **CASCLib**: https://github.com/ladislav-zezula/CascLib
- **WoW.export**: https://github.com/Kruithne/wow.export

---

**Version**: 1.0.0
**Last Updated**: 2025-11-10
**Maintainer**: TrinityCore-MCP Team
