#!/usr/bin/env python3
import re

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Scanning for unescaped apostrophes in zone/map names...\n")

issues_found = []

# Check lines in the knownMapNames and knownZoneNames sections
in_map_names = False
in_zone_names = False

for i, line in enumerate(lines, 1):
    if 'const knownMapNames' in line:
        in_map_names = True
        in_zone_names = False
        continue
    elif 'const knownZoneNames' in line:
        in_zone_names = True
        in_map_names = False
        continue
    elif in_map_names and '};' in line:
        in_map_names = False
    elif in_zone_names and '};' in line:
        in_zone_names = False

    if (in_map_names or in_zone_names) and re.match(r'\s+\d+:', line):
        # Extract the string value
        match = re.search(r": '([^']*(?:\\'[^']*)*)',", line)
        if match:
            name = match.group(1)
            # Check for unescaped apostrophes (apostrophes not preceded by backslash)
            # Split by \' to get segments, then check each segment for apostrophes
            segments = name.split("\\'")
            for seg_idx, segment in enumerate(segments):
                if "'" in segment:
                    issues_found.append({
                        'line': i,
                        'text': line.strip(),
                        'name': name,
                        'section': 'knownMapNames' if in_map_names else 'knownZoneNames'
                    })
                    break

if issues_found:
    print(f"❌ Found {len(issues_found)} unescaped apostrophes:\n")
    for issue in issues_found:
        print(f"Line {issue['line']} ({issue['section']}):")
        print(f"  {issue['text']}")
        print(f"  Name: {issue['name']}\n")
else:
    print("✅ No unescaped apostrophes found!")
    print("All zone and map names are properly escaped.")
