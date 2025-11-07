#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of QuestTitle with LogTitle
original_count = content.count('QuestTitle')
content = content.replace('QuestTitle', 'LogTitle')

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"SUCCESS: Replaced {original_count} occurrences of 'QuestTitle' with 'LogTitle'")
