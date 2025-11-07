#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the knownZoneNames section (starts around line 155)
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'const knownZoneNames: Record<number, string> = {' in line:
        start_idx = i
    if start_idx is not None and '};' in line and i > start_idx:
        end_idx = i
        break

if start_idx and end_idx:
    # Replace the zone names section with comprehensive list
    new_zone_section = [
        '    // Comprehensive zone names from WoW (Classic through Wrath)\n',
        '    const knownZoneNames: Record<number, string> = {\n',
        '      // Eastern Kingdoms - Alliance Starting Zones\n',
        '      1: \'Dun Morogh\',\n',
        '      12: \'Elwynn Forest\',\n',
        '      38: \'Loch Modan\',\n',
        '      40: \'Westfall\',\n',
        '      44: \'Redridge Mountains\',\n',
        '      51: \'Searing Gorge\',\n',
        '\n',
        '      // Eastern Kingdoms - Horde Starting Zones\n',
        '      14: \'Durotar\',\n',
        '      85: \'Tirisfal Glades\',\n',
        '      130: \'Silverpine Forest\',\n',
        '\n',
        '      // Eastern Kingdoms - Mid-Level Zones\n',
        '      3: \'Badlands\',\n',
        '      4: \'Blasted Lands\',\n',
        '      8: \'Swamp of Sorrows\',\n',
        '      10: \'Duskwood\',\n',
        '      11: \'Wetlands\',\n',
        '      23: \'Burning Steppes\',\n',
        '      28: \'Western Plaguelands\',\n',
        '      33: \'Stranglethorn Vale\',\n',
        '      36: \'Alterac Mountains\',\n',
        '      45: \'Arathi Highlands\',\n',
        '      47: \'The Hinterlands\',\n',
        '      139: \'Eastern Plaguelands\',\n',
        '      267: \'Hillsbrad Foothills\',\n',
        '\n',
        '      // Eastern Kingdoms - Cities\n',
        '      1519: \'Stormwind City\',\n',
        '      1537: \'Ironforge\',\n',
        '      1657: \'Darnassus\',\n',
        '      1497: \'Undercity\',\n',
        '      1638: \'Orgrimmar\',\n',
        '      1637: \'Thunder Bluff\',\n',
        '      3487: \'Silvermoon City\',\n',
        '      3557: \'The Exodar\',\n',
        '\n',
        '      // Kalimdor - Alliance Starting Zones\n',
        '      141: \'Teldrassil\',\n',
        '      148: \'Darkshore\',\n',
        '      3524: \'Azuremyst Isle\',\n',
        '      3525: \'Bloodmyst Isle\',\n',
        '\n',
        '      // Kalimdor - Horde Starting Zones\n',
        '      215: \'Mulgore\',\n',
        '\n',
        '      // Kalimdor - Mid-Level Zones\n',
        '      331: \'Ashenvale\',\n',
        '      357: \'Feralas\',\n',
        '      361: \'Felwood\',\n',
        '      400: \'Thousand Needles\',\n',
        '      405: \'Desolace\',\n',
        '      406: \'Stonetalon Mountains\',\n',
        '      440: \'Tanaris\',\n',
        '      490: \'Un\\\'Goro Crater\',\n',
        '      493: \'Moonglade\',\n',
        '      618: \'Winterspring\',\n',
        '      1377: \'Silithus\',\n',
        '      2597: \'Alterac Valley\',\n',
        '      3430: \'Eversong Woods\',\n',
        '      3433: \'Ghostlands\',\n',
        '\n',
        '      // Outland Zones (TBC)\n',
        '      3483: \'Hellfire Peninsula\',\n',
        '      3518: \'Nagrand\',\n',
        '      3519: \'Terokkar Forest\',\n',
        '      3520: \'Shadowmoon Valley\',\n',
        '      3521: \'Zangarmarsh\',\n',
        '      3522: \'Blade\\\'s Edge Mountains\',\n',
        '      3523: \'Netherstorm\',\n',
        '\n',
        '      // Northrend Zones (Wrath)\n',
        '      65: \'Dragonblight\',\n',
        '      66: \'Zul\\\'Drak\',\n',
        '      67: \'The Storm Peaks\',\n',
        '      210: \'Icecrown\',\n',
        '      394: \'Grizzly Hills\',\n',
        '      495: \'Howling Fjord\',\n',
        '      3537: \'Borean Tundra\',\n',
        '      4197: \'Wintergrasp\',\n',
        '      4395: \'Dalaran\',\n',
        '      4742: \'Hrothgar\\\'s Landing\',\n',
        '\n',
        '      // Special Zones\n',
        '      616: \'Mount Hyjal\',\n',
        '      2817: \'Crystalsong Forest\',\n',
        '      4080: \'Isle of Quel\\\'Danas\',\n',
        '    };\n',
    ]

    # Replace lines
    lines[start_idx:end_idx+1] = new_zone_section

    # Write file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    print("SUCCESS: Updated zone names")
else:
    print("ERROR: Could not find zone names section")
