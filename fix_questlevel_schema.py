#!/usr/bin/env python3
"""
Auto-fix script for QuestLevel column references
Replaces all SQL column references from QuestLevel to qta.MaxLevel
"""

import re
from pathlib import Path

fixes = [
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\dataexplorer.ts',
        'line': 246,
        'old': 'ID, LogTitle, QuestLevel, MinLevel, QuestType',
        'new': 'qt.ID, qt.LogTitle, qta.MaxLevel as QuestLevel, qt.MinLevel, qt.QuestInfoID as QuestType',
        'note': 'Need to add LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\quest.ts',
        'line': 34,
        'old': 'QuestLevel as level,',
        'new': 'qta.MaxLevel as level,',
        'note': 'Ensure LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID exists'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\questmapper.ts',
        'line': 69,
        'old': 'QuestLevel as level,',
        'new': 'qta.MaxLevel as level,',
        'note': 'Ensure LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID exists'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\questmapper.ts',
        'line': 388,
        'old': 'ORDER BY QuestLevel, ID',
        'new': 'ORDER BY qta.MaxLevel, qt.ID',
        'note': 'Ensure LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID exists'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\questmapper.ts',
        'line': 408,
        'old': 'ORDER BY QuestLevel, ID',
        'new': 'ORDER BY qta.MaxLevel, qt.ID',
        'note': 'Ensure LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID exists'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\questroute.ts',
        'line': 489,
        'old': 'SELECT ID, QuestLevel, RewardXP, RewardMoney, RewardItem1, RewardItem2, RewardItem3, RewardItem4',
        'new': 'SELECT qt.ID, qta.MaxLevel as QuestLevel, qt.RewardXPDifficulty as RewardXP, qt.RewardMoney, qt.RewardItem1, qt.RewardItem2, qt.RewardItem3, qt.RewardItem4',
        'note': 'Need to add FROM quest_template qt LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID'
    },
    {
        'file': r'C:\TrinityBots\trinitycore-mcp\src\tools\zonedifficulty.ts',
        'line': 220,
        'old': 'QuestLevel,',
        'new': 'qta.MaxLevel as QuestLevel,',
        'note': 'Ensure LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID exists'
    }
]

print("=" * 80)
print("QuestLevel Schema Fix Script")
print("=" * 80)
print()
print("Found {} SQL queries that need fixing".format(len(fixes)))
print()

for i, fix in enumerate(fixes, 1):
    print(f"{i}. {fix['file']}")
    print(f"   Line {fix['line']}")
    print(f"   OLD: {fix['old']}")
    print(f"   NEW: {fix['new']}")
    print(f"   NOTE: {fix['note']}")
    print()

print("=" * 80)
print("Manual fix required - these queries use QuestLevel without proper JOIN")
print("=" * 80)
print()
print("Each file needs to be reviewed to ensure:")
print("1. The query includes: LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID")
print("2. All columns are properly prefixed with table alias (qt. or qta.)")
print("3. QuestLevel is replaced with qta.MaxLevel")
print()
