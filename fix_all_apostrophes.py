#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix ALL unescaped apostrophes in zone/map names
replacements = {
    # Map names
    "'Zul'Gurub'": "'Zul\\'Gurub'",
    "'Ruins of Ahn'Qiraj'": "'Ruins of Ahn\\'Qiraj'",
    "'Ahn'Qiraj Temple'": "'Ahn\\'Qiraj Temple'",
    "'Magtheridon's Lair'": "'Magtheridon\\'s Lair'",
    "'Gruul's Lair'": "'Gruul\\'s Lair'",
    "'Zul'Aman'": "'Zul\\'Aman'",
    "'Drak'Tharon Keep'": "'Drak\\'Tharon Keep'",
    "'Ahn'kahet: The Old Kingdom'": "'Ahn\\'kahet: The Old Kingdom'",
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed all remaining apostrophe escaping issues")
