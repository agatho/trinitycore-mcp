#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove the two NextQuestID requirement lines
content = content.replace(
    '''      AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
      AND qta.NextQuestID IS NOT NULL
      AND qta.NextQuestID != 0
    LIMIT 50''',
    '''      AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
    LIMIT 100'''
)

# Fix 2: Change comment to reflect new behavior
content = content.replace(
    '  // Find all quests in zone that are chain starters (no previous quest)',
    '  // Find all quests in zone that are potential chain starters\n  // Removed NextQuestID requirement - many chains only use PrevQuestID'
)

# Fix 3: Include standalone quests (totalQuests >= 1)
content = content.replace(
    '      if (chain.totalQuests > 1) { // Only include actual chains (2+ quests)',
    '      // Include all quests, even standalone ones (chains of 1 quest)\n      if (chain.totalQuests >= 1) {'
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed quest chain query to show all quests")
