#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Line 202: MinLevel and MaxLevel without table prefix
# These should use qta.MaxLevel since MinLevel doesn't exist
content = content.replace(
    'qt.ID as questId, qt.LogTitle as name, MinLevel as minLevel, MaxLevel as maxLevel,',
    'qt.ID as questId, qt.LogTitle as name, qta.MaxLevel as minLevel, qta.MaxLevel as maxLevel,'
)

# Fix Line 203: qt.QuestLevel doesn't exist, use qta.MaxLevel
content = content.replace(
    'qt.QuestLevel as questLevel,',
    'qta.MaxLevel as questLevel,'
)

# Fix Line 277: qt.QuestLevel doesn't exist, use qta.MaxLevel
content = content.replace(
    'qt.ID as questId, qt.LogTitle as name, qt.QuestLevel as level,',
    'qt.ID as questId, qt.LogTitle as name, qta.MaxLevel as level,'
)

# Fix Line 895: qt.MinLevel doesn't exist, use qta.MaxLevel
content = content.replace(
    'MIN(qt.MinLevel) as minLevel, MAX(qt.MinLevel) as maxLevel',
    'MIN(qta.MaxLevel) as minLevel, MAX(qta.MaxLevel) as maxLevel'
)

# Fix Line 1004: qt.MinLevel and qt.QuestLevel don't exist
content = content.replace(
    'qt.MinLevel, qt.QuestLevel,',
    'qta.MaxLevel as MinLevel, qta.MaxLevel as QuestLevel,'
)

# Fix Line 1011: qt.MinLevel doesn't exist
content = content.replace(
    'AND qt.MinLevel <= ?',
    'AND qta.MaxLevel <= ?'
)

# Fix Line 1012: qt.QuestLevel doesn't exist
content = content.replace(
    'AND qt.QuestLevel <= ? + 5',
    'AND qta.MaxLevel <= ? + 5'
)

# Fix Line 1013: ORDER BY qt.QuestLevel doesn't exist
content = content.replace(
    'ORDER BY qt.QuestLevel, qt.ID',
    'ORDER BY qta.MaxLevel, qt.ID'
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed all MinLevel and QuestLevel references to use qta.MaxLevel")
