#!/usr/bin/env python3
import re

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\quest-chains\page.tsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the Zone Selector section to add Map selector before it
old_section = r'''        {/\* Zone Selector and Search \*/}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <label className="text-sm font-semibold text-white mb-2 block">Select Zone</label>
            \{loadingZones \? \(
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading zones\.\.\.
              </div>
            \) : \(
              <Select onValueChange=\{handleZoneChange\} value=\{selectedZone\} disabled=\{!selectedMap\}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a zone\.\.\." />
                </SelectTrigger>
                <SelectContent>
                  \{filteredZones\.map\(\(zone\) => \(
                    <SelectItem key=\{zone\.id\} value=\{zone\.id\.toString\(\)\}>
                      \{zone\.name\} \(\{zone\.questCount\} quests\)
                    </SelectItem>
                  \)\)\}
                </SelectContent>
              </Select>
            \)\}
          </div>'''

new_section = '''        {/* Map, Zone Selector and Search */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-white mb-2 block">Select Map</label>
              {loadingZones ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading maps...
                </div>
              ) : (
                <Select onValueChange={handleMapChange} value={selectedMap}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a map..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maps.map((map) => (
                      <SelectItem key={map.id} value={map.id.toString()}>
                        {map.name} ({map.zoneCount} zones)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-2 block">Select Zone</label>
              {loadingZones ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading zones...
                </div>
              ) : (
                <Select onValueChange={handleZoneChange} value={selectedZone} disabled={!selectedMap}>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedMap ? "First select a map..." : "Choose a zone..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredZones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id.toString()}>
                        {zone.name} ({zone.questCount} quests)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>'''

# Apply the replacement
content = re.sub(old_section, new_section, content, flags=re.DOTALL)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added map selector to quest-chains page")
print("- Map selector added before zone selector")
print("- Zone selector placeholder updated to show 'First select a map...' when no map selected")
