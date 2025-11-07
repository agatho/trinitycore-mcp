#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the missing apostrophe
content = content.replace("'Magisters' Terrace'", "'Magisters\\' Terrace'")

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed Magisters' Terrace apostrophe")
