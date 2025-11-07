#!/usr/bin/env python3
import re

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\quest-chains\page.tsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix line 209: Properly format the handleMapChange function and filteredZones useMemo
# Replace the squashed code with properly formatted multi-line code
old_pattern_209 = r"const handleMapChange = \(mapId: string\) => \{    setSelectedMap\(mapId\);    setSelectedZone\('\); // Reset zone when map changes  \};  // Filter zones by selected map  const filteredZones = useMemo\(\(\) => \{    if \(!selectedMap\) return zones;    return zones\.filter\(zone => zone\.mapId\.toString\(\) === selectedMap\);  \}, \[zones, selectedMap\]\);"

new_code_209 = """const handleMapChange = (mapId: string) => {
    setSelectedMap(mapId);
    setSelectedZone(''); // Reset zone when map changes
  };

  // Filter zones by selected map
  const filteredZones = useMemo(() => {
    if (!selectedMap) return zones;
    return zones.filter(zone => zone.mapId.toString() === selectedMap);
  }, [zones, selectedMap]);"""

# Fix line 213: Properly format the zone extraction code
old_pattern_213 = r"      // Extract zoneId from composite key \"mapId-zoneId\"      const zoneIdNum = parseInt\(zoneId\.split\('-'\)\[1\]\);      fetchQuestChainsInZone\(zoneIdNum\);"

new_code_213 = """      // Extract zoneId from composite key "mapId-zoneId"
      const zoneIdNum = parseInt(zoneId.split('-')[1]);
      fetchQuestChainsInZone(zoneIdNum);"""

# Apply fixes
content = re.sub(old_pattern_209, new_code_209, content)
content = re.sub(old_pattern_213, new_code_213, content)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed quest-chains/page.tsx syntax errors")
print("- Line 209: Formatted handleMapChange and filteredZones")
print("- Line 213: Formatted zone extraction code")
