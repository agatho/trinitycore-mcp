#!/usr/bin/env python3

"""
Generate comprehensive ZONE_BOUNDARIES configuration for ALL zones and maps.
This creates coordinate-based fallback detection for any zone with incorrect zoneId.
"""

import re

# Read the zone boundary data from MySQL output
with open(r'C:\TrinityBots\all_zone_boundaries.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse zone data (skip header)
zones = []
for line in lines[1:]:
    parts = line.strip().split('\t')
    if len(parts) == 7:
        zone_id = int(parts[0])
        map_id = int(parts[1])
        quest_count = int(parts[2])
        min_x = int(float(parts[3]))
        max_x = int(float(parts[4]))
        min_y = int(float(parts[5]))
        max_y = int(float(parts[6]))

        zones.append({
            'zoneId': zone_id,
            'map': map_id,
            'questCount': quest_count,
            'minX': min_x,
            'maxX': max_x,
            'minY': min_y,
            'maxY': max_y
        })

print(f"Parsed {len(zones)} zones with quest data")

# Generate TypeScript ZONE_BOUNDARIES configuration
ts_config = """// ============================================================================
// ZONE BOUNDARY DEFINITIONS
// ============================================================================

/**
 * Zone boundaries for coordinate-based detection
 * Fallback for creatures with incorrect/missing zoneId
 *
 * Auto-generated from database coordinate analysis
 * Covers ALL zones with quests across all maps
 *
 * Key format: "zoneId_mapId" to handle phased/instanced zones
 */
interface ZoneBoundary {
  zoneId: number;
  map: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const ZONE_BOUNDARIES: Record<string, ZoneBoundary> = {
"""

# Add all zones with composite keys
for zone in zones:
    key = f"{zone['zoneId']}_{zone['map']}"
    ts_config += f"  '{key}': {{ "
    ts_config += f"zoneId: {zone['zoneId']}, "
    ts_config += f"map: {zone['map']}, "
    ts_config += f"minX: {zone['minX']}, "
    ts_config += f"maxX: {zone['maxX']}, "
    ts_config += f"minY: {zone['minY']}, "
    ts_config += f"maxY: {zone['maxY']} "
    ts_config += f"}}, // {zone['questCount']} quests\n"

ts_config += "};\n\n"""

# Add helper function to get all boundaries for a zone
ts_config += """/**
 * Get all zone boundaries for a given zoneId (may span multiple maps)
 */
function getZoneBoundaries(zoneId: number): ZoneBoundary[] {
  return Object.values(ZONE_BOUNDARIES).filter(b => b.zoneId === zoneId);
}

"""

print(f"Generated TypeScript configuration with {len(zones)} zone boundaries")

# Read current questchain.ts file
file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the existing ZONE_BOUNDARIES section
# Pattern: from "// ============================================================================\n// ZONE BOUNDARY DEFINITIONS"
#          to the end of "const ZONE_BOUNDARIES..."
pattern = re.compile(
    r'// ============================================================================\n'
    r'// ZONE BOUNDARY DEFINITIONS\n'
    r'// ============================================================================\n.*?'
    r'const ZONE_BOUNDARIES:.*?\n\};\n\n',
    re.DOTALL
)

if pattern.search(content):
    content = pattern.sub(ts_config, content)
    print("[OK] Replaced existing ZONE_BOUNDARIES section")
else:
    # If not found, insert before TYPE DEFINITIONS
    insert_point = content.find('// ============================================================================\n// TYPE DEFINITIONS')
    if insert_point != -1:
        content = content[:insert_point] + ts_config + content[insert_point:]
        print("[OK] Inserted new ZONE_BOUNDARIES section")
    else:
        print("[ERROR] Could not find insertion point!")
        exit(1)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n[SUCCESS] Updated questchain.ts with {len(zones)} zone boundaries")
print(f"  Covers all zones across all maps with coordinate-based fallback detection")
