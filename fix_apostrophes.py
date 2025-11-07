#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix all unescaped apostrophes in zone/map names
replacements = {
    "'Zul'Farrak'": "'Zul\\'Farrak'",
    "'Zul'Drak'": "'Zul\\'Drak'",
    "'Blade's Edge Mountains'": "'Blade\\'s Edge Mountains'",
    "'Onyxia's Lair'": "'Onyxia\\'s Lair'",
    "'Un'Goro Crater'": "'Un\\'Goro Crater'",
    "'Hrothgar's Landing'": "'Hrothgar\\'s Landing'",
    "'Isle of Quel'Danas'": "'Isle of Quel\\'Danas'",
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed all apostrophe escaping issues")
